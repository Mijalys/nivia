import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ZodError, ZodType, z } from 'zod';

/**
 * Error con código estable. El frontend usa `code` para mostrar los textos ya redactados
 * en los cortes ("La evaluación necesita señal", "Usaste tus 3 intentos", etc.).
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new ApiError(404, 'NOT_FOUND', `${what} no encontrado`);

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private log = new Logger('Error');
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
      return;
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      res.status(status).json({ error: { code: status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR', message: err.message } });
      return;
    }
    this.log.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Ocurrió un error. Vuelve a intentarlo.' } });
  }
}

/** Valida un cuerpo o parámetro con zod y responde 400 con el detalle si no cumple. */
export function parse<S extends ZodType>(schema: S, value: unknown): z.infer<S> {
  try {
    return schema.parse(value);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Datos inválidos', {
        issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      });
    }
    throw e;
  }
}

export const uuid = z.string().uuid();
