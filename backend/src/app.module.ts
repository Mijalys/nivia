import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth';
import { ApiErrorFilter } from './common/errors';
import { CLOCK, CONFIG, Clock, Config, DB, EMAIL, GOOGLE } from './config';
import { Db } from './db/db';
import { AdminAuthController, AdminController, AdminGuard, AdminService } from './modules/admin';
import { AssessmentController, AssessmentService } from './modules/assessment';
import { CertificationController, CertificationService } from './modules/certification';
import { EmailSender } from './modules/email';
import { GoogleVerifier } from './modules/google';
import { AuthController, AuthService, MeController } from './modules/identity';
import { LearningController, LearningService } from './modules/learning';
import { MediaController } from './modules/media';
import { TenantsController, TenantsService } from './modules/tenants';

export interface AppDeps { config: Config; db: Db; clock: Clock; email: EmailSender; google: GoogleVerifier }

/** Proveedores de infraestructura: configuración, base, reloj, correo y Google. Las pruebas pasan los suyos. */
@Global()
@Module({})
class CoreModule {
  static with(deps: AppDeps): DynamicModule {
    const providers = [
      { provide: CONFIG, useValue: deps.config },
      { provide: DB, useValue: deps.db },
      { provide: CLOCK, useValue: deps.clock },
      { provide: EMAIL, useValue: deps.email },
      { provide: GOOGLE, useValue: deps.google }
    ];
    return { module: CoreModule, providers, exports: providers };
  }
}

@Module({})
export class AppModule {
  static with(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.with(deps)],
      controllers: [TenantsController, AuthController, MeController, LearningController, AssessmentController, CertificationController, MediaController,
        AdminAuthController, AdminController],
      providers: [
        TenantsService, AuthService, LearningService, AssessmentService, CertificationService, AdminService, AdminGuard,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: ApiErrorFilter }
      ]
    };
  }
}
