import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth';
import { ApiErrorFilter } from './common/errors';
import { CLOCK, CONFIG, Clock, Config, DB, SMS } from './config';
import { Db } from './db/db';
import { AdminAuthController, AdminController, AdminGuard, AdminService } from './modules/admin';
import { AssessmentController, AssessmentService } from './modules/assessment';
import { CertificationController, CertificationService } from './modules/certification';
import { AuthController, AuthService, MeController } from './modules/identity';
import { LearningController, LearningService } from './modules/learning';
import { MediaController } from './modules/media';
import { SmsSender } from './modules/notifications';
import { TenantsController, TenantsService } from './modules/tenants';

export interface AppDeps { config: Config; db: Db; clock: Clock; sms: SmsSender }

/** Proveedores de infraestructura: configuración, base, reloj y SMS. Las pruebas pasan los suyos. */
@Global()
@Module({})
class CoreModule {
  static with(deps: AppDeps): DynamicModule {
    const providers = [
      { provide: CONFIG, useValue: deps.config },
      { provide: DB, useValue: deps.db },
      { provide: CLOCK, useValue: deps.clock },
      { provide: SMS, useValue: deps.sms }
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
