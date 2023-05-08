import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as Docker from 'dockerode';
import { AuthGuard } from '@nestjs/passport';
import { Configuration, OpenAIApi } from 'openai'

@Controller('file')
export class FileController {
  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
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
    })
  )
  // async analyzeFile(@UploadedFile() file: Express.Multer.File) {
  //   try {
  //     console.log(file.filename);

  //     const docker = new Docker();
  //     const container = await docker.createContainer({
  //       HostConfig: {
  //         Binds: [`${process.cwd()}/uploads:/mnt`],
  //       },

  //       Image: 'mythril/myth:latest',
  //       Cmd: ['analyze', `/mnt/${file.filename}`],


  //     });


  //     await container.start();

  //     const logs = await container.logs({
  //       follow: true,
  //       stdout: true,
  //       stderr: true,
  //     });

  //     let logsData = '';
  //     logs.pipe(process.stdout);
  //     logs.on('data', async(data) => {
  //        logsData += data;
  //     });





  //     logs.on('end', async() => {
  //       container.remove({ force: true });
  //     });

  //   } catch (err) {
  //     console.error('Error creating or starting container:', err);
  //   }
  // }

  async analyzeSlither(@UploadedFile() file: Express.Multer.File) {
    try {
      console.log(file.filename);

      const docker = new Docker();
      const container = await docker.createContainer({
        HostConfig: {
          Binds: [`${process.cwd()}/uploads:/mnt`],
        },

        Image: 'trailofbits/slither:latest',
        Cmd: [`slither`,  `/mnt/${file.filename}`],
        Tty: true


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




      logs.on('end', async () => {
        await parseOutput(logsData);
        container.remove({ force: true });
      });




    } catch (err) {
      console.error('Error creating or starting container:', err);
    }
  }
}
async function parseOutput(output: string): Promise<void> {

  const configuration = new Configuration({
    apiKey: process.env.OPEN_AI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);


  try {    
    const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{role: 'user', content: `parse the output to json\n
    things to keep in mind:\n
    every single parameter is one error\n
    the format should be as followed:\n
    errorNumber: {\n
      error:\n
      (optional) reference:\n
    }\n\n
    this is the output:\n
      ${output.toString()}`}],
  })
  console.log(completion.data.choices[0].message?.content);
   } catch (err) {
    console.log(err)
  }


}






