import { readNxJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from '../application/application';
import { setupDockerGenerator } from './setup-docker';

describe('setupDockerGenerator', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    jest.resetModules();
  });

  describe('integrated', () => {
    it('should create docker assets when --docker is passed', async () => {
      const projectName = 'integreated-api';

      await applicationGenerator(tree, {
        directory: projectName,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        skipDockerPlugin: true, // Use legacy mode for this test
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);

      const dockerFile = tree.read(`${projectName}/Dockerfile`, 'utf8');
      expect(tree.exists(`${projectName}/Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker:build': {
            dependsOn: ['build', 'prune'],
            command: `docker build . -t ${projectName}`,
            options: {
              cwd: project.root,
            },
          },
        })
      );
    });
  });

  describe('standalone', () => {
    it('should create docker assets when --docker is passed', async () => {
      const projectName = 'standalone-api';

      await applicationGenerator(tree, {
        name: projectName,
        directory: '.',
        framework: 'fastify',
        docker: true,
        skipDockerPlugin: true, // Use legacy mode for this test
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);
      const dockerFile = tree.read(`Dockerfile`, 'utf8');

      expect(tree.exists(`Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker:build': {
            dependsOn: ['build', 'prune'],
            command: `docker build . -t ${projectName}`,
            options: {
              cwd: project.root,
            },
          },
        })
      );
    });
  });

  describe('skipDockerPlugin', () => {
    it('should create docker:build target when skipDockerPlugin is true', async () => {
      const projectName = 'api-with-legacy-docker';

      await applicationGenerator(tree, {
        directory: projectName,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        skipDockerPlugin: true,
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);
      const dockerFile = tree.read(`${projectName}/Dockerfile`, 'utf8');

      expect(tree.exists(`${projectName}/Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(dockerFile).toContain(
        `COPY ${projectName}/package.json ${projectName}/`
      );
      expect(dockerFile).toContain(
        'Build the docker image with `npx nx docker:build'
      );
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker:build': {
            dependsOn: ['build', 'prune'],
            command: `docker build . -t ${projectName}`,
            options: {
              cwd: project.root,
            },
          },
        })
      );
    });

    it('should not create docker:build target when skipDockerPlugin is false', async () => {
      const projectName = 'api-with-plugin-docker';

      await applicationGenerator(tree, {
        directory: projectName,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        skipDockerPlugin: false,
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);
      const dockerFile = tree.read(`${projectName}/Dockerfile`, 'utf8');

      expect(tree.exists(`${projectName}/Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist ${projectName}/`);
      expect(dockerFile).toContain(`COPY package.json ${projectName}/`);
      expect(dockerFile).toContain(
        'Build the docker image with `npx nx docker:build'
      );
      expect(project.targets?.['docker-build']).toBeUndefined();

      expect(readNxJson(tree)).toEqual(
        expect.objectContaining({
          plugins: expect.arrayContaining([
            {
              plugin: '@nx/docker',
              options: {
                buildTarget: 'docker:build',
                runTarget: 'docker:run',
              },
            },
          ]),
        })
      );
    });

    it('should use project-relative paths when skipDockerPlugin is false', async () => {
      const projectName = 'nested-api';

      await applicationGenerator(tree, {
        directory: `apps/${projectName}`,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        skipDockerPlugin: false,
        addPlugin: true,
      });

      const dockerFile = tree.read(`apps/${projectName}/Dockerfile`, 'utf8');

      expect(dockerFile).toContain(`COPY dist nested-api/`);
      expect(dockerFile).toContain(`COPY package.json nested-api/`);
      expect(dockerFile).not.toContain(`apps/${projectName}`);
    });

    it('should use workspace-relative paths when skipDockerPlugin is true', async () => {
      const projectName = 'nested-api-legacy';

      await applicationGenerator(tree, {
        directory: `apps/${projectName}`,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        skipDockerPlugin: true,
        addPlugin: true,
      });

      const dockerFile = tree.read(`apps/${projectName}/Dockerfile`, 'utf8');

      expect(dockerFile).toContain(
        `COPY dist/apps/${projectName} nested-api-legacy/`
      );
      expect(dockerFile).toContain(
        `COPY apps/${projectName}/package.json nested-api-legacy/`
      );
    });
  });

  describe('project name sanitization', () => {
    it('should sanitize project names with special characters for Docker commands', async () => {
      const projectName = '@myorg/my-app';

      await applicationGenerator(tree, {
        name: projectName,
        directory: '.',
        framework: 'express',
        e2eTestRunner: 'none',
        addPlugin: true,
      });

      await setupDockerGenerator(tree, {
        project: projectName,
        outputPath: 'dist/myorg/my-app',
        skipDockerPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);

      expect(project.targets['docker:build']).toEqual({
        dependsOn: ['build', 'prune'],
        command: `docker build . -t myorg-my-app`,
        options: {
          cwd: project.root,
        },
      });

      expect(tree.read('Dockerfile', 'utf8')).toMatchInlineSnapshot(`
        "# This file is generated by Nx.
        # Build the docker image with \`npx nx docker:build @myorg/my-app\`.
        # Tip: Modify "docker:build" options in project.json to change docker build args.
        #
        # Run the container with \`docker run -p 3000:3000 -t myorg-my-app\`.
        #
        FROM docker.io/node:lts-alpine

        ENV HOST=0.0.0.0
        ENV PORT=3000

        WORKDIR /app

        RUN addgroup --system myorg-my-app && \\
                  adduser --system -G myorg-my-app myorg-my-app

        COPY dist/myorg/my-app myorg-my-app/
        COPY ./package.json myorg-my-app/
        RUN chown -R myorg-my-app:myorg-my-app .

        # You can remove this install step if you build with \`--bundle\` option.
        # The bundled output will include external dependencies.
        RUN npm --prefix myorg-my-app --omit=dev -f install

        CMD [ "node", "myorg-my-app" ]
        "
      `);
    });

    it('should sanitize project names with slashes and other special characters', async () => {
      const projectName = 'my/special@app';

      await applicationGenerator(tree, {
        name: projectName,
        directory: '.',
        framework: 'express',
        e2eTestRunner: 'none',
        addPlugin: true,
      });

      await setupDockerGenerator(tree, {
        project: projectName,
        outputPath: 'dist/basic-app',
        skipDockerPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);

      expect(project.targets['docker:build']).toEqual({
        dependsOn: ['build', 'prune'],
        command: `docker build . -t my-special-app`,
        options: {
          cwd: project.root,
        },
      });

      expect(tree.read('Dockerfile', 'utf8')).toMatchInlineSnapshot(`
        "# This file is generated by Nx.
        # Build the docker image with \`npx nx docker:build my/special@app\`.
        # Tip: Modify "docker:build" options in project.json to change docker build args.
        #
        # Run the container with \`docker run -p 3000:3000 -t my-special-app\`.
        #
        FROM docker.io/node:lts-alpine

        ENV HOST=0.0.0.0
        ENV PORT=3000

        WORKDIR /app

        RUN addgroup --system my-special-app && \\
                  adduser --system -G my-special-app my-special-app

        COPY dist/basic-app my-special-app/
        COPY ./package.json my-special-app/
        RUN chown -R my-special-app:my-special-app .

        # You can remove this install step if you build with \`--bundle\` option.
        # The bundled output will include external dependencies.
        RUN npm --prefix my-special-app --omit=dev -f install

        CMD [ "node", "my-special-app" ]
        "
      `);
    });

    it('should handle uppercase and multiple special characters', async () => {
      const projectName = 'My_App@123/Test';

      await applicationGenerator(tree, {
        name: projectName,
        directory: '.',
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        skipDockerPlugin: true, // Use legacy mode for this test
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);

      expect(project.targets['docker:build']).toEqual({
        dependsOn: ['build', 'prune'],
        command: `docker build . -t my_app-123-test`,
        options: {
          cwd: project.root,
        },
      });

      expect(tree.read('Dockerfile', 'utf8')).toMatchInlineSnapshot(`
        "# This file is generated by Nx.
        # Build the docker image with \`npx nx docker:build My_App@123/Test\`.
        # Tip: Modify "docker:build" options in project.json to change docker build args.
        #
        # Run the container with \`docker run -p 3000:3000 -t my_app-123-test\`.
        #
        FROM docker.io/node:lts-alpine

        ENV HOST=0.0.0.0
        ENV PORT=3000

        WORKDIR /app

        RUN addgroup --system my_app-123-test && \\
                  adduser --system -G my_app-123-test my_app-123-test

        COPY dist/My_App@123/Test my_app-123-test/
        COPY ./package.json my_app-123-test/
        RUN chown -R my_app-123-test:my_app-123-test .

        # You can remove this install step if you build with \`--bundle\` option.
        # The bundled output will include external dependencies.
        RUN npm --prefix my_app-123-test --omit=dev -f install

        CMD [ "node", "my_app-123-test" ]
        "
      `);
    });

    it('should ensure docker:build target works with sanitized names in Dockerfile', async () => {
      const projectName = '@scope/my-app';

      await applicationGenerator(tree, {
        name: projectName,
        directory: '.',
        framework: 'express',
        e2eTestRunner: 'none',
        addPlugin: true,
      });

      await setupDockerGenerator(tree, {
        project: projectName,
        outputPath: 'dist/scope/my-app',
        skipDockerPlugin: true,
      });

      const dockerfileContent = tree.read('Dockerfile', 'utf8');

      expect(dockerfileContent).toMatch(/^FROM\s+\S+/m);
      expect(dockerfileContent).toMatch(/^WORKDIR\s+\S+/m);
      expect(dockerfileContent).toMatch(/^CMD\s+\[/m);

      // Verify user/group names are valid (no special chars that would break Linux)
      const userGroupMatches = dockerfileContent.match(
        /addgroup --system (\S+)/
      );
      const userGroupName = userGroupMatches?.[1];
      expect(userGroupName).toMatch(/^[a-z0-9._-]+$/);
      expect(userGroupName).not.toContain('@');
      expect(userGroupName).not.toContain('/');

      const project = readProjectConfiguration(tree, projectName);
      expect(project.targets['docker:build'].command).toContain(
        `-t ${userGroupName}`
      );
    });
  });
});
