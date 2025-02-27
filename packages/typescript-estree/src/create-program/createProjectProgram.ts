import debug from 'debug';
import path from 'path';
import * as ts from 'typescript';
import { getProgramsForProjects } from './createWatchProgram';
import { firstDefined } from '../node-utils';
import { Extra } from '../parser-options';
import { ASTAndProgram, getAstFromProgram } from './shared';

const log = debug('typescript-eslint:typescript-estree:createProjectProgram');

const DEFAULT_EXTRA_FILE_EXTENSIONS = [
  ts.Extension.Ts,
  ts.Extension.Tsx,
  ts.Extension.Js,
  ts.Extension.Jsx,
  ts.Extension.Mjs,
  ts.Extension.Mts,
  ts.Extension.Cjs,
  ts.Extension.Cts,
] as readonly string[];

/**
 * @param code The code of the file being linted
 * @param createDefaultProgram True if the default program should be created
 * @param extra The config object
 * @returns If found, returns the source file corresponding to the code and the containing program
 */
function createProjectProgram(
  code: string,
  createDefaultProgram: boolean,
  extra: Extra,
): ASTAndProgram | undefined {
  log('Creating project program for: %s', extra.filePath);

  const astAndProgram = firstDefined(
    getProgramsForProjects(code, extra.filePath, extra),
    currentProgram => getAstFromProgram(currentProgram, extra),
  );

  if (!astAndProgram && !createDefaultProgram) {
    // the file was either not matched within the tsconfig, or the extension wasn't expected
    const errorLines = [
      '"parserOptions.project" has been set for @typescript-eslint/parser.',
      `The file does not match your project config: ${path.relative(
        extra.tsconfigRootDir || process.cwd(),
        extra.filePath,
      )}.`,
    ];
    let hasMatchedAnError = false;

    const extraFileExtensions = extra.extraFileExtensions || [];

    extraFileExtensions.forEach(extraExtension => {
      if (!extraExtension.startsWith('.')) {
        errorLines.push(
          `Found unexpected extension "${extraExtension}" specified with the "extraFileExtensions" option. Did you mean ".${extraExtension}"?`,
        );
      }
      if (DEFAULT_EXTRA_FILE_EXTENSIONS.includes(extraExtension)) {
        errorLines.push(
          `You unnecessarily included the extension "${extraExtension}" with the "extraFileExtensions" option. This extension is already handled by the parser by default.`,
        );
      }
    });

    const fileExtension = path.extname(extra.filePath);
    if (!DEFAULT_EXTRA_FILE_EXTENSIONS.includes(fileExtension)) {
      const nonStandardExt = `The extension for the file (${fileExtension}) is non-standard`;
      if (extraFileExtensions.length > 0) {
        if (!extraFileExtensions.includes(fileExtension)) {
          errorLines.push(
            `${nonStandardExt}. It should be added to your existing "parserOptions.extraFileExtensions".`,
          );
          hasMatchedAnError = true;
        }
      } else {
        errorLines.push(
          `${nonStandardExt}. You should add "parserOptions.extraFileExtensions" to your config.`,
        );
        hasMatchedAnError = true;
      }
    }

    if (!hasMatchedAnError) {
      errorLines.push(
        'The file must be included in at least one of the projects provided.',
      );
    }

    throw new Error(errorLines.join('\n'));
  }

  return astAndProgram;
}

export { createProjectProgram };
