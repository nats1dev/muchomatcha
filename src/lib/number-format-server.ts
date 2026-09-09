import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  DEFAULT_NUMBER_SETTINGS,
  type NumberDisplaySettings,
  type NumberFormatStyle,
} from "@/lib/number-format";

export const getNumberDisplaySettings = cache(
  async (businessId: string): Promise<NumberDisplaySettings> => {
    const row = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        numberFormat: true,
        moneyDecimals: true,
        costDecimals: true,
        quantityDecimals: true,
      },
    });
    if (!row) return DEFAULT_NUMBER_SETTINGS;
    return {
      ...row,
      numberFormat: row.numberFormat as NumberFormatStyle,
    };
  },
);
