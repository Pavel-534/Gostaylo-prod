/**
 * FilterBar - 4 fields: What | Where | When | Who (Airbnb-style)
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { MapPin, Users, CalendarIcon, X, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { getUIText, getCategoryName } from '@/lib/translations';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';

export function FilterBar({
  language = 'en',
  dateRange,
  setDateRange,
  selectedCategory,
  setSelectedCategory,
  where,
  setWhere,
  guests,
  setGuests,
  clearDates,
  nights = 0
}) {
  const locale = language === 'ru' ? ru : enUS;

  return (
    <>
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold mb-3">
            {getUIText('searchResults', language)}
          </h1>

          {/* Active Filters - 4 items max */}
          {(dateRange.from && dateRange.to) || (selectedCategory && selectedCategory !== 'all') || (where && where !== 'all') || guests !== '1' ? (
            <div className="flex flex-wrap items-center gap-2">
              {selectedCategory && selectedCategory !== 'all' && (
                <Badge className="bg-white text-teal-700">
                  <Layers className="h-4 w-4 mr-1" />
                  {getCategoryName(selectedCategory, language) || selectedCategory}
                </Badge>
              )}
              {(dateRange.from && dateRange.to) && (
                <Badge className="bg-white text-teal-700 hover:bg-white/90 flex items-center gap-2 px-3 py-1">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}
                  <span className="text-teal-500">({nights} {language === 'ru' ? 'н.' : 'n.'})</span>
                  <button onClick={clearDates} className="ml-1 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {guests !== '1' && (
                <Badge className="bg-white text-teal-700">
                  <Users className="h-4 w-4 mr-1" />
                  {guests} {language === 'ru' ? 'гостей' : 'guests'}
                </Badge>
              )}
              {where && where !== 'all' && (
                <Badge className="bg-white text-teal-700">
                  <MapPin className="h-4 w-4 mr-1" />
                  {where}
                </Badge>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white border-b sticky top-12 z-10">
        <div className="container mx-auto px-4 py-3">
          <UnifiedSearchBar
            variant="filter"
            language={language}
            category={selectedCategory}
            setCategory={setSelectedCategory}
            where={where}
            setWhere={setWhere}
            dateRange={dateRange}
            setDateRange={setDateRange}
            guests={guests}
            setGuests={setGuests}
          />
        </div>
      </div>
    </>
  );
}
