import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DrinksModule } from './drinks/drinks.module';
import { OrdersModule } from './orders/orders.module';
import { ConsumptionsModule } from './consumptions/consumptions.module';
import { RatingsModule } from './ratings/ratings.module';
import { PhotosModule } from './photos/photos.module';
import { PrismaModule } from './prisma/prisma.module';
import { BarsModule } from './bars/bars.module';
import { FriendsModule } from './friends/friends.module';
import { BarManagementModule } from './bar-management/bar-management.module';
import { EventsModule } from './events/events.module';
import { AdminModule } from './admin/admin.module';
import { TagsModule } from './tags/tags.module';
import { MenusModule } from './menus/menus.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    PushNotificationsModule,
    AuthModule,
    UsersModule,
    DrinksModule,
    OrdersModule,
    ConsumptionsModule,
    RatingsModule,
    PhotosModule,
    BarsModule,
    FriendsModule,
    BarManagementModule,
    AdminModule,
    TagsModule,
    MenusModule,
    CustomFieldsModule,
  ],
})
export class AppModule {}
