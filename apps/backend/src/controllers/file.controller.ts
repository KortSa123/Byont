import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as Docker from 'dockerode';

@Controller('file')
export class FileController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const filename = file.originalname;
          cb(null, filename);
        },
      }),
    }),
  )
  async analyzeFile(@UploadedFile() file: Express.Multer.File) {
    try {
      console.log(file.filename);

      const docker = new Docker();
      const container = await docker.createContainer({
        Image: 'mythril/myth:latest',
        Cmd: ['analyze', `/mnt/${file.filename}`],

        HostConfig: {
          Binds: [`${process.cwd()}/uploads:/mnt`],
        },
      });

      await container.start();

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

      logs.on('end', () => {
        console.log('Logs:', logsData);
        container.remove({ force: true });
      });
    } catch (err) {
      console.error('Error creating or starting container:', err);
    }
  }
}
