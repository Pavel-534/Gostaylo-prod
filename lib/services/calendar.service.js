/**
 * GoStayLo — Calendar service facade (Stage 70.5)
 * SSOT entrypoints delegate to query / update / pricing submodules.
 */

import { CalendarQueryLayer } from '@/lib/services/calendar/calendar-query.service';
import { CalendarUpdateLayer } from '@/lib/services/calendar/calendar-update.service';
import {
  calculateDailyPrice,
  resolveMarketingPromoForDay,
  getSeasonLabel,
  mapMarketingPromoToPartnerCell,
} from '@/lib/services/calendar/calendar-pricing.service';

export class CalendarService {
  static getCalendar = CalendarQueryLayer.getCalendar.bind(CalendarQueryLayer);
  static buildCalendar = CalendarQueryLayer.buildCalendar.bind(CalendarQueryLayer);
  static getCalendarForDateRange = CalendarQueryLayer.getCalendarForDateRange.bind(CalendarQueryLayer);
  static mapBuildCalendarToPartnerAvailability =
    CalendarQueryLayer.mapBuildCalendarToPartnerAvailability.bind(CalendarQueryLayer);
  static mapPartnerCalendarGridRow = CalendarQueryLayer.mapPartnerCalendarGridRow.bind(CalendarQueryLayer);
  static checkAvailability = CalendarQueryLayer.checkAvailability.bind(CalendarQueryLayer);
  static findVehicleIntervalConflicts = CalendarQueryLayer.findVehicleIntervalConflicts.bind(
    CalendarQueryLayer,
  );
  static validateManualBlockFits = CalendarQueryLayer.validateManualBlockFits.bind(CalendarQueryLayer);

  static checkBatchAvailability = CalendarUpdateLayer.checkBatchAvailability.bind(CalendarUpdateLayer);

  static calculateDailyPrice = calculateDailyPrice;
  static resolveMarketingPromoForDay = resolveMarketingPromoForDay;
  static getSeasonLabel = getSeasonLabel;
  static mapMarketingPromoToPartnerCell = mapMarketingPromoToPartnerCell;
}

export default CalendarService;
