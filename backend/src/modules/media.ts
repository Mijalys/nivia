import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';
import { Public } from '../common/auth';
import { checkPathSig } from '../common/crypto';
import { ApiError } from '../common/errors';
import { CLOCK, CONFIG, Clock, Config } from '../config';

/**
 * Archivos del almacenamiento local con URL firmada (videos, portadas, paquetes).
 * En producción los sirve la CDN desde el almacenamiento de objetos con la misma idea de URL firmada.
 */
@Controller('media')
export class MediaController {
  constructor(@Inject(CONFIG) private cfg: Config, @Inject(CLOCK) private clock: Clock) {}

  @Public()
  @Get('*path')
  serve(@Req() req: Request, @Res() res: Response) {
    const path = decodeURIComponent(req.path);
    const ok = checkPathSig(path, req.query.exp as string | undefined, req.query.sig as string | undefined,
      this.cfg.secret, Math.floor(this.clock.now().getTime() / 1000));
    if (!ok) throw new ApiError(403, 'MEDIA_URL_EXPIRED', 'El enlace del archivo venció. Vuelve a abrir la lección.');
    const root = resolve(this.cfg.storageDir);
    const file = resolve(root, path.replace(/^\/media\//, ''));
    if (!file.startsWith(root + sep) || !existsSync(file)) throw new ApiError(404, 'NOT_FOUND', 'Archivo no encontrado');
    // sendFile responde con Range, así el video se puede adelantar y la descarga retomar desde donde quedó.
    // Con ?dl=1 el navegador lo descarga con su nombre (material de apoyo) en vez de abrirlo.
    const headers: Record<string, string> = {};
    if (req.query.dl === '1') headers['Content-Disposition'] = `attachment; filename="${basename(file).replace(/"/g, '')}"`;
    res.sendFile(file, { acceptRanges: true, maxAge: '1h', headers });
  }
}
