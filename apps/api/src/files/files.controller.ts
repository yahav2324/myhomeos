import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function filename(_req: any, file: any, cb: any) {
  const ext = (extname(file.originalname || '.jpg') || '.jpg').toLowerCase();
  const safe = ALLOWED_EXT.has(ext) ? ext : '.jpg';
  cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safe}`);
}

function fileFilter(_req: any, file: any, cb: any) {
  const ext = (extname(file.originalname || '') || '').toLowerCase();
  const okExt = ALLOWED_EXT.has(ext);
  const okMime = ALLOWED_MIME.has(String(file.mimetype || '').toLowerCase());

  if (!okExt || !okMime) {
    return cb(new BadRequestException('Only JPG/PNG/WEBP images are allowed'), false);
  }
  cb(null, true);
}

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads/images',
        filename,
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter,
    }),
  )
  uploadImage(@UploadedFile() file?: any) {
    if (!file) throw new BadRequestException('Missing file');
    const imageUrl = `/uploads/images/${file.filename}`;
    return { ok: true, data: { imageUrl } };
  }
}
