// apps/client-api/src/bars/bars.controller.ts

import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as QRCode from 'qrcode';
import { BarsService } from './bars.service';

@Controller('bars')
export class BarsController {
  constructor(private barsService: BarsService) {}

  @Get()
  async findAll() {
    return this.barsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.barsService.findOne(id);
  }

  @Get(':id/qrcode')
  async getQRCode(@Param('id') barId: string, @Res() res: Response) {
    const bar = await this.barsService.findOne(barId); // ⭐ OK

    if (!bar) {
      return res.status(404).json({ message: 'Bar not found' });
    }

    const qrData = JSON.stringify({
      type: 'bar',
      barId: bar.id,
      name: bar.name,
    });

    const qrCodeImage = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
    });

    res.json({
      barId: bar.id,
      barName: bar.name,
      qrCode: qrCodeImage,
    });
  }

  @Get(':barId/qrcode/image')
  async getQRCodeImage(
    @Param('barId') barId: string,
    @Query('format') format: string = 'png',
    @Query('color') color: string = '#000000',
    @Query('bgColor') bgColor: string = '#ffffff',
    @Query('size') size: string = '500',
    @Res() res: Response,
  ) {
    const bar = await this.barsService.findOne(barId); // ⭐ CORRIGER (était this.prisma.bar.findUnique)

    if (!bar) {
      return res.status(404).json({ message: 'Bar not found' });
    }

    const qrData = JSON.stringify({
      type: 'bar',
      barId: bar.id,
      name: bar.name,
    });

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: parseInt(size),
        color: {
          dark: color,
          light: bgColor,
        },
        errorCorrectionLevel: 'H',
      });

      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader('Content-Disposition', `inline; filename=qrcode-${bar.name}.${format}`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: 'Error generating QR code' });
    }
  }

  @Get(':barId/qrcode/svg')
  async getQRCodeSVG(
    @Param('barId') barId: string,
    @Query('color') color: string = '#000000',
    @Query('bgColor') bgColor: string = '#ffffff',
    @Res() res: Response,
  ) {
    const bar = await this.barsService.findOne(barId); // ⭐ CORRIGER (était this.prisma.bar.findUnique)

    if (!bar) {
      return res.status(404).json({ message: 'Bar not found' });
    }

    const qrData = JSON.stringify({
      type: 'bar',
      barId: bar.id,
      name: bar.name,
    });

    try {
      const svg = await QRCode.toString(qrData, {
        type: 'svg',
        color: {
          dark: color,
          light: bgColor,
        },
        errorCorrectionLevel: 'H',
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `inline; filename=qrcode-${bar.name}.svg`);
      res.send(svg);
    } catch (error) {
      res.status(500).json({ message: 'Error generating QR code' });
    }
  }
}