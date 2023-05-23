import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Docker from 'dockerode';
import { parseOutput } from 'src/utils/output-parser';
import { PrismaClient, Scanner } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { RepoService } from './repo.service';
import { UsersService } from './users.service';
import { ConfigService } from '@nestjs/config';
import { Stream } from 'stream';
import { EmailService } from './email.service';

type ScanResultItem = {
  scanner: Scanner;
  filename: string;
  output: any;
};

@Injectable()
export class FileService {
  private docker: Docker;
  private imageTag = 'slither-image';
  constructor(
    private prisma: PrismaService,
    private repoService: RepoService,
    private userService: UsersService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    this.docker = new Docker();
    this.prisma = new PrismaClient();
  }
  async analyzeMythril(repoName: string, user: any) {
    try {
      const currentDir = __dirname;
      const rootDir = path.join(currentDir, '..', '..', '..', '..', '..');
      const contractsDir = path.join(
        rootDir,
        'apps',
        'backend',
        'src',
        'contracts',
        `${repoName}`
      );

      const solFiles = fs
        .readdirSync(contractsDir)
        .filter((file) => path.extname(file) === '.sol');
      console.log(contractsDir);
      const scanResults: ScanResultItem[] = [];
      for (const filename of solFiles) {
        console.log(`Analyzing ${filename}`);

        const docker = new Docker();
        const container = await docker.createContainer({
          HostConfig: {
            Binds: [`${contractsDir}:/mnt`],
          },

          Image: 'mythril/myth:latest',
          Cmd: ['analyze', `/mnt/${filename}`, '-o', 'json'],
          Tty: true,
        });

        await container.start();

        const logs = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
        });

        let logsData = '';
        logs.pipe(process.stdout);
        logs.on('data', async (data) => {
          logsData += data;
        });
        console.log('logsdata', logsData);

        await new Promise<void>((resolve, reject) => {
          logs.on('end', async () => {
            const output = this.removeNonPrintableChars(logsData);
            console.log('output with no characters', output);
            const userId = await this.userService.findIdByEmail(user);
            const repoId = await this.repoService.findRepoByNameAndUserId(
              repoName,
              userId!
            );
            const GPTResponse = await parseOutput(output, this.configService);
            console.log('GPTResponse', GPTResponse);

            // Push the result into the scanResults array
            scanResults.push({
              scanner: Scanner.MYTHRIL,
              filename: filename,
              output: output,
            });

            await container.remove({ force: true });
            resolve();
          });
          logs.on('error', (err) => {
            reject(err);
          });
        });
      }

      // Create a single scanResult entry with the scanResults array
      const userId = await this.userService.findIdByEmail(user);
      const repoId = await this.repoService.findRepoByNameAndUserId(
        repoName,
        userId!
      );
      await this.prisma.scanResult.create({
        data: {
          repo: { connect: { id: repoId } },
          scanner: Scanner.MYTHRIL,
          filename: 'Multiple Files',
          output: scanResults,
        },
      });
    } catch (err) {
      console.error('Error creating or starting container:', err);
    }
    await this.emailService.sendScanPerformedEmail(user, repoName);
  }
  async processFile(file: Express.Multer.File) {
    // Do something with the file, e.g., read its content, process it, etc.
    const content = fs.readFileSync(file.path, 'utf8');
    fs.rm(file.path, () => {
      console.log(content);
    });
  }

  async analyzeSlither(repoName: string, user: any) {
    try {
      let requestCounter = 0;
      const currentDir = __dirname;
      const rootDir = path.join(currentDir, '..', '..', '..', '..', '..');
      const contractsDir = path.join(
        rootDir,
        'apps',
        'backend',
        'src',
        'contracts',
        `${repoName}`
      );
      const solFiles = fs
        .readdirSync(contractsDir)
        .filter((file) => path.extname(file) === '.sol');
      console.log(contractsDir);
      // loop through the .sol files
      for (const filename of solFiles) {
        console.log(`Analyzing ${filename}`);

        // create and start the Docker container
        const docker = new Docker();
        const container = await docker.createContainer({
          HostConfig: {
            Binds: [`${contractsDir}:/mnt`],
          },
          Image: 'trailofbits/slither:latest',
          Cmd: [
            'slither',
            `/mnt/${filename}`,
            '--json',
            `/mnt/output-${filename}.json`,
          ],
        });

        await container.start();

        // collect logs and print them to the console
        const logs = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
        });

        let logsData = '';
        logs.pipe(process.stdout);
        logs.on('data', (data) => {
          logsData += data;
        });

        await new Promise<void>((resolve, reject) => {
          logs.on('end', async () => {
            const output = this.removeNonPrintableChars(logsData);
            console.log('output with no characters', output);
            const userId = await this.userService.findIdByEmail(user);
            const repoId = await this.repoService.findRepoByNameAndUserId(
              repoName,
              userId!
            );
            await this.delay(1000);
            const GPTResponse = await parseOutput(output, this.configService);
            console.log('GPTResponse', GPTResponse);
            await this.prisma.scanResult.create({
              data: {
                repo: { connect: { id: repoId } },
                scanner: Scanner.SLITHER,
                filename: filename,
                output: output,
              },
            });

            //await container.remove({ force: true });
            resolve();
          });
          logs.on('error', (err) => {
            reject(err);
          });
        });
        console.log(requestCounter);
      }
    } catch (err) {
      console.error('Error creating or starting container:', err);
    }
  }

  async createContainer(file: Express.Multer.File) {
    const container = await this.docker.createContainer({
      Image: 'trailofbits/eth-security-toolbox',
      name: 'slither',
      Tty: true,
      HostConfig: {
        Binds: [`${process.cwd()}/uploads:/mnt`]
      },
    });

    // Start the container
    await container.start();

    // Check if the container is running before proceeding
    let isRunning = false;
    while (!isRunning) {
      const data = await container.inspect();
      if (data.State.Running) {
        isRunning = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1s before next check
      }
    }

    await this.execDeleteFile(file, container);
    await this.execAnalyzeFile(file, container);
    await this.delay(1000)
    //await this.execPrintJson(file, container);

  }


  removeNonPrintableChars(s: string): string {
    return s
      .split('')
      .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126)
      .join('');
  }

  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  async execDeleteFile(file: Express.Multer.File, container: Docker.Container) {
    try {
      const exec1 = await container.exec({
        Cmd: ['rm', '-f', `/mnt/${file.filename}.json`],
        AttachStdout: true,
        AttachStderr: true
      });
      await exec1.start({ hijack: true, stdin: true });
      console.log('deleted previous json file output if it exists');
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  }

  async execAnalyzeFile(file: Express.Multer.File, container: Docker.Container) {
    const exec2 = await container.exec({
      Cmd: ['slither', `/mnt/${file.filename}`, '--json', `/mnt/${file.filename}.json`, '--print', 'human-summary'],
      AttachStdout: true,
      AttachStderr: true
    });
    const execStream2 = await exec2.start({ hijack: true, stdin: true });

    // Log the output of the second command
    let logStream2 = new Stream.PassThrough();
    logStream2.on('data', (chunk) => console.log(chunk.toString('utf8')));
    exec2.modem.demuxStream(execStream2, logStream2, logStream2);
    execStream2.on('end', () => logStream2.end());
  }

  async execPrintJson(file: Express.Multer.File, container: Docker.Container) {
    const exec3 = await container.exec({
      Cmd: ['cat', `/mnt/${file.filename}.json`],
      AttachStdout: true,
      AttachStderr: true
    });

    const execStream3 = await exec3.start({ hijack: true, stdin: true });

    let logStream3 = new Stream.PassThrough();
    logStream3.on('data', (chunk) => console.log(chunk.toString('utf8')));
    exec3.modem.demuxStream(execStream3, logStream3, logStream3);
    execStream3.on('end', () => logStream3.end());
  }


}
