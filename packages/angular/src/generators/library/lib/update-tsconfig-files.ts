import { joinPathFragments, type Tree, updateJson } from '@nx/devkit';
import {
  addTsConfigPath,
  extractTsConfigBase,
  getRelativePathToRootTsConfig,
  getRootTsConfigFileName,
} from '@nx/js';
import { getNeededCompilerOptionOverrides } from '@nx/js/src/utils/typescript/configuration';
import { lt } from 'semver';
import { updateProjectRootTsConfig } from '../../utils/update-project-root-tsconfig';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export function updateTsConfigFiles(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  extractTsConfigBase(tree);
  updateProjectConfig(tree, options);
  updateProjectIvyConfig(tree, options);

  // Only add tsconfig path mapping if skipTsConfig is not true
  if (!options.skipTsConfig) {
    addTsConfigPath(tree, options.importPath, [
      joinPathFragments(options.projectRoot, './src', 'index.ts'),
    ]);
  }

  const compilerOptions: Record<string, any> = {
    skipLibCheck: true,
    experimentalDecorators: true,
    importHelpers: true,
    target: 'es2022',
    moduleResolution: 'bundler',
    ...(options.strict
      ? {
          strict: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        }
      : {}),
  };

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (lt(angularVersion, '18.1.0')) {
    compilerOptions.useDefineForClassFields = false;
  }
  if (angularMajorVersion >= 20) {
    compilerOptions.module = 'preserve';
  } else {
    compilerOptions.module = 'es2022';
  }

  const tsconfigPath = joinPathFragments(options.projectRoot, 'tsconfig.json');
  updateJson(tree, tsconfigPath, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      ...compilerOptions,
    };
    json.compilerOptions = getNeededCompilerOptionOverrides(
      tree,
      json.compilerOptions,
      getRootTsConfigFileName(tree)
    );

    if (options.strict) {
      json.angularCompilerOptions = {
        ...json.angularCompilerOptions,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
        typeCheckHostBindings: angularMajorVersion >= 20 ? true : undefined,
        strictTemplates: true,
      };
    }

    return json;
  });

  if (options.unitTestRunner === 'jest') {
    const tsconfigSpecPath = joinPathFragments(
      options.projectRoot,
      'tsconfig.spec.json'
    );
    updateJson(tree, tsconfigSpecPath, (json) => {
      json.compilerOptions = {
        ...json.compilerOptions,
        module: 'commonjs',
        moduleResolution: 'node10',
      };
      json.compilerOptions = getNeededCompilerOptionOverrides(
        tree,
        json.compilerOptions,
        tsconfigPath
      );
      return json;
    });
  }
}

function updateProjectConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  updateJson(host, `${options.projectRoot}/tsconfig.lib.json`, (json) => {
    json.include = ['src/**/*.ts'];
    json.exclude = [
      ...new Set([
        ...(json.exclude || []),
        'jest.config.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ]),
    ];
    return json;
  });

  // tsconfig.json
  updateProjectRootTsConfig(
    host,
    options.projectRoot,
    getRelativePathToRootTsConfig(host, options.projectRoot)
  );
}

function updateProjectIvyConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.buildable || options.publishable) {
    return updateJson(
      host,
      `${options.projectRoot}/tsconfig.lib.prod.json`,
      (json) => {
        json.angularCompilerOptions['compilationMode'] =
          options.compilationMode === 'full' ? undefined : 'partial';
        return json;
      }
    );
  }
}
