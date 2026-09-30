const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vscode = require('vscode');

function inspectEnvironment(environment) {
  const executable = environment?.executable?.uri?.fsPath;
  const folder = environment?.environment?.folderUri?.fsPath;
  const isConda = environment?.environment?.type === 'Conda';
  const r = folder && path.join(folder, 'Scripts', 'R.exe');
  const radian = folder && path.join(folder, 'Scripts', 'radian.exe');

  return {
    python: executable ?? environment?.path ?? null,
    type: environment?.environment?.type ?? null,
    folder: folder ?? null,
    r: isConda && r && fs.existsSync(r) ? r : null,
    radian: isConda && radian && fs.existsSync(radian) ? radian : null,
  };
}

function createLauncher(env, directory) {
  if (/["%\^&|<>!\r\n]/.test(env.folder)) {
    throw new Error('Ruta Conda contiene caracteres incompatibles con cmd.exe.');
  }
  const conda = path.resolve(env.folder, '..', '..', 'condabin', 'conda.bat');
  if (!fs.existsSync(conda)) {
    throw new Error(`No se encontró conda.bat en ${conda}`);
  }
  const rBinary = path.join(env.folder, 'Lib', 'R', 'bin', 'x64', 'R.exe');
  if (!fs.existsSync(rBinary)) {
    throw new Error(`No se encontró R.exe en ${rBinary}`);
  }
  // ponytail: solo Conda en Windows; añadir otros gestores cuando exista un caso real.
  const name = crypto.createHash('sha256').update(env.folder.toLowerCase()).digest('hex').slice(0, 12);
  const launcher = path.join(directory, `radian-${name}.cmd`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(launcher, [
    '@echo off',
    `call "${conda}" activate "${env.folder}"`,
    'if errorlevel 1 exit /b 1',
    `set "R_LIBS_USER=${path.join(env.folder, 'Lib', 'R', 'library')}"`,
    `"${env.radian}" --r-binary="${rBinary}"`,
    '',
  ].join('\r\n'));
  return launcher;
}

async function syncFolder(api, folder, directory) {
  const selected = api.environments.getActiveEnvironmentPath(folder.uri);
  const environment = selected?.path
    ? await api.environments.resolveEnvironment(selected)
    : undefined;
  const result = inspectEnvironment(environment);
  const config = vscode.workspace.getConfiguration('r', folder.uri);
  const terminal = vscode.workspace.getConfiguration('terminal.integrated', folder.uri);
  const terminalEnv = terminal.get('env.windows') ?? {};
  const target = vscode.ConfigurationTarget.WorkspaceFolder;
  if (!result.r || !result.radian) {
    // ponytail: solo borra configuración creada por este puente; conservar ajustes propios.
    if (config.get('consolePath')?.startsWith(path.join(directory, 'radian-'))) {
      await config.update('consolePath', undefined, target);
      await config.update('executablePath', undefined, target);
      if (/^[^;]+\\Library\\bin;\$\{env:PATH\}$/.test(terminalEnv.PATH ?? '')) {
        const { PATH, ...remaining } = terminalEnv;
        await terminal.update('env.windows', remaining, target);
      }
    }
    return;
  }

  const launcher = createLauncher(result, directory);
  const dllPath = path.join(result.folder, 'Library', 'bin');
  const terminalPath = `${dllPath};\${env:PATH}`;
  if (terminalEnv.PATH !== terminalPath) {
    await terminal.update('env.windows', { ...terminalEnv, PATH: terminalPath }, target);
  }
  if (config.get('executablePath') !== result.r) {
    await config.update('executablePath', result.r, target);
  }
  if (config.get('consolePath') !== launcher) {
    await config.update('consolePath', launcher, target);
  }
}

async function activate(context) {
  const python = vscode.extensions.getExtension('ms-python.python');
  if (!python) return;

  try {
    const api = await python.activate();
    await api.ready;
    // ponytail: PATH del host solo puede aislarse por ventana; usar un proyecto por ventana.
    const originalPath = process.env.PATH ?? process.env.Path ?? '';
    let currentDllPath;
    context.subscriptions.push({ dispose: () => { process.env.PATH = originalPath; } });
    const sync = async (folder) => {
      const selected = api.environments.getActiveEnvironmentPath(folder.uri);
      const environment = selected?.path
        ? await api.environments.resolveEnvironment(selected)
        : undefined;
      const result = inspectEnvironment(environment);
      if (result.r && result.radian) {
        currentDllPath = path.join(result.folder, 'Library', 'bin');
        process.env.PATH = `${currentDllPath};${originalPath}`;
      } else if (currentDllPath) {
        process.env.PATH = originalPath;
        currentDllPath = undefined;
      }
      await syncFolder(api, folder, context.globalStorageUri.fsPath);
    };
    const safeSync = (folder) => sync(folder)
      .catch((error) => console.error(`R Python Probe: ${error.message}`));

    context.subscriptions.push(api.environments.onDidChangeActiveEnvironmentPath((event) => {
      const folder = vscode.workspace.workspaceFolders?.find(
        (item) => item.uri.toString() === (event.resource?.uri ?? event.resource)?.toString(),
      );
      if (folder) void safeSync(folder);
      else if (!event.resource) vscode.workspace.workspaceFolders?.forEach((item) => void safeSync(item));
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      event.added.forEach((folder) => void safeSync(folder));
    }));
    vscode.workspace.workspaceFolders?.forEach((folder) => void safeSync(folder));
  } catch (error) {
    console.error(`R Python Probe: ${error.message}`);
  }
}

module.exports = { activate, inspectEnvironment, createLauncher, syncFolder };
