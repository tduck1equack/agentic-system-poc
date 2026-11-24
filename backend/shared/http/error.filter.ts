import { ArgumentsHost, Catch, HttpException, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';
import { DomainError } from '../domain/errors';
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 400;
    let message = 'Operation failed. Check input, credentials, endpoint, or installation limits.';
    if (error instanceof DomainError) {
      status = { invalid: 400, not_found: 404, forbidden: 403, unauthorized: 401, conflict: 409 }[error.code];
      message = error.message;
    } else if (error instanceof ZodError) message = 'Invalid input';
    else if (error instanceof HttpException) { status = error.getStatus(); message = error.message; }
    host.switchToHttp().getResponse().status(status).json({ error: message });
  }
}
