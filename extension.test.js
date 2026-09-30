const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r-python-probe-'));
const env = path.join(root, 'envs', 'project');
const settings = { r: new Map(), 'terminal.integrated': new Map() };
let changes = 0;
const folder = { uri: { fsPath: root, toString: () => root } };
const vscode = {
  ConfigurationTarget: { WorkspaceFolder: 5 },
  workspace: {
    getConfiguration: (section, resource) => {
      assert.equal(resource, folder.uri);
      const values = settings[section];
      assert.ok(values);
      return {
        get: (key) => values.get(key),
        update: async (key, value, target) => {
          assert.equal(target, 5);
          values.set(key, value);
          changes += 1;
        },
      };
    },
  },
};
const load = Module._load;
Module._load = function (name, ...args) {
  return name === 'vscode' ? vscode : load.call(this, name, ...args);
};
const { syncFolder } = require('./extension');
Module._load = load;

async function main() {
  fs.mkdirSync(path.join(root, 'condabin'), { recursive: true });
  fs.mkdirSync(path.join(env, 'Scripts'), { recursive: true });
  fs.mkdirSync(path.join(env, 'Lib', 'R', 'bin', 'x64'), { recursive: true });
  for (const file of [
    path.join(root, 'condabin', 'conda.bat'),
    path.join(env, 'Scripts', 'R.exe'),
    path.join(env, 'Scripts', 'radian.exe'),
    path.join(env, 'Lib', 'R', 'bin', 'x64', 'R.exe'),
  ]) fs.writeFileSync(file, '');

  const api = { environments: {
    getActiveEnvironmentPath: () => ({ path: path.join(env, 'python.exe') }),
    resolveEnvironment: async () => ({ environment: { type: 'Conda', folderUri: { fsPath: env } } }),
  } };
  await syncFolder(api, folder, path.join(root, 'storage'));
  assert.equal(settings.r.get('executablePath'), path.join(env, 'Scripts', 'R.exe'));
  assert.equal(settings['terminal.integrated'].get('env.windows').PATH,
    `${path.join(env, 'Library', 'bin')};\${env:PATH}`);
  assert.match(fs.readFileSync(settings.r.get('consolePath'), 'utf8'), /conda\.bat/);
  assert.match(fs.readFileSync(settings.r.get('consolePath'), 'utf8'), /R_LIBS_USER=/);
  await syncFolder(api, folder, path.join(root, 'storage'));
  assert.equal(changes, 3);

  api.environments.resolveEnvironment = async () => undefined;
  await syncFolder(api, folder, path.join(root, 'storage'));
  assert.equal(changes, 6);
  assert.equal(settings.r.get('consolePath'), undefined);
  assert.equal(settings.r.get('executablePath'), undefined);
  assert.deepEqual(settings['terminal.integrated'].get('env.windows'), {});
  settings.r.set('consolePath', 'C:\\my-radian.cmd');
  await syncFolder(api, folder, path.join(root, 'storage'));
  assert.equal(settings.r.get('consolePath'), 'C:\\my-radian.cmd');
  console.log('Sincronización por proyecto: OK');
}

main().finally(() => fs.rmSync(root, { recursive: true, force: true }));