/**
 * FilterBar Component
 * Extracted from /app/app/listings/page.js
 * Handles search, dates, district, guests, price filters
 */

'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Users, CalendarIcon, X } from 'lucide-react';
import { SearchCalendar } from '@/components/search-calendar';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

const DISTRICTS = [
  'Rawai', 'Kata', 'Karon', 'Patong', 'Kamala', 'Surin', 'Bang Tao', 
  'Nai Harn', 'Chalong', 'Phuket Town', 'Cape Panwa'
];

export function FilterBar({
  language = 'en',
  searchQuery,
  setSearchQuery,
  dateRange,
  setDateRange,
  selectedDistrict,
  setSelectedDistrict,
  guests,
  setGuests,
  priceRange,
  setPriceRange,
  clearDates,
  nights = 0
}) {
  const locale = language === 'ru' ? ru : enUS;
  
  return (
    <>
      {/* Hero Section with Active Filters */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold mb-3">
            {language === 'ru' ? 'Результаты поиска' : 'Search Results'}
          </h1>
          
          {/* Active Filters */}
          {(dateRange.from && dateRange.to) && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white text-teal-700 hover:bg-white/90 flex items-center gap-2 px-3 py-1">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}
                <span className="text-teal-500">({nights} {language === 'ru' ? 'н.' : 'n.'})</span>
                <button onClick={clearDates} className="ml-1 hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              {guests !== '1' && (
                <Badge className="bg-white text-teal-700">
                  <Users className="h-4 w-4 mr-1" />
                  {guests} {language === 'ru' ? 'гостей' : 'guests'}
                </Badge>
              )}
              {selectedDistrict !== 'all' && (
                <Badge className="bg-white text-teal-700">
                  <MapPin className="h-4 w-4 mr-1" />
                  {selectedDistrict}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b sticky top-12 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Search */}
            <div className="col-span-2 md:col-span-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
                data-testid="listings-search-input"
              />
            </div>

            {/* Date Picker */}
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={language === 'ru' ? 'Даты' : 'Dates'}
              className="h-9 border rounded-md justify-start px-3"
            />

            {/* District */}
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="h-9">
                <MapPin className="h-4 w-4 mr-2 text-teal-600" />
                <span className="truncate">
                  {selectedDistrict === 'all' ? (language === 'ru' ? 'Район' : 'District') : selectedDistrict}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ru' ? 'Все районы' : 'All districts'}</SelectItem>
                {DISTRICTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Guests */}
            <Select value={guests} onValueChange={setGuests}>
              <SelectTrigger className="h-9">
                <Users className="h-4 w-4 mr-2 text-teal-600" />
                <span>{guests} {language === 'ru' ? 'гостей' : 'guests'}</span>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {language === 'ru' ? 'гостей' : 'guests'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}
