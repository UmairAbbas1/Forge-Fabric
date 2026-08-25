import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { getAllCountries, getCitiesForCountry, getStateNameForCity } from '../../lib/geoData';

interface CountryCityStateFieldsProps {
  country: string;
  city: string;
  state: string;
  onCountryChange: (country: string) => void;
  /** Fires with the derived state name already resolved — callers just store both. */
  onCityChange: (city: string, state: string) => void;
  cityError?: string;
  size?: 'sm' | 'md';
}

const MAX_SUGGESTIONS = 40;

export const CountryCityStateFields: React.FC<CountryCityStateFieldsProps> = ({
  country,
  city,
  state,
  onCountryChange,
  onCityChange,
  cityError,
  size = 'md',
}) => {
  const countries = useMemo(() => getAllCountries(), []);
  const citiesForCountry = useMemo(() => getCitiesForCountry(country), [country]);

  const [cityQuery, setCityQuery] = useState(city || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => setCityQuery(city || ''), [city]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return citiesForCountry.slice(0, MAX_SUGGESTIONS);
    return citiesForCountry.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [citiesForCountry, cityQuery]);

  const selectCity = (cityName: string, stateCode: string) => {
    const stateName = getStateNameForCity(country, stateCode);
    // Keep the query field showing just the city name (what the customer
    // typed), but the resolved state is exactly the one they picked from
    // the disambiguated (city, state) suggestion, not a name-only guess.
    setCityQuery(cityName);
    onCityChange(cityName, stateName);
    setShowSuggestions(false);
  };

  const heightClass = size === 'sm' ? 'h-10' : 'h-11';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Country *</label>
        <select
          value={country || ''}
          onChange={(e) => {
            onCountryChange(e.target.value);
            // Changing country invalidates the previously-selected city/state.
            setCityQuery('');
            onCityChange('', '');
          }}
          className={`w-full ${heightClass} px-3 border border-neutral-300 rounded-xl text-xs bg-white font-medium`}
        >
          <option value="" disabled>Select country...</option>
          {countries.map((c) => (
            <option key={c.isoCode} value={c.name}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="relative" ref={wrapperRef}>
        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">City *</label>
        <div className="relative">
          <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            disabled={!country}
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setShowSuggestions(true);
              // Free-typed city with no matching real record — clear any
              // stale derived state rather than leaving a mismatched one.
              onCityChange(e.target.value, '');
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={country ? 'Start typing a city...' : 'Select a country first'}
            className={`w-full ${heightClass} pl-8 pr-7 border rounded-xl text-xs bg-white disabled:bg-neutral-100 disabled:cursor-not-allowed ${
              cityError ? 'border-red-400' : 'border-neutral-300'
            }`}
          />
          <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>
        {cityError && <p className="text-[10px] text-red-600 font-bold mt-1">{cityError}</p>}
        {showSuggestions && country && filteredCities.length > 0 && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-lg">
            {filteredCities.map((c) => {
              // Many cities share a name across different states (e.g. four
              // real "Austin"s in the US alone) — always show the state so
              // the customer picks the right one, not an arbitrary match.
              const stateName = getStateNameForCity(country, c.stateCode);
              return (
                <button
                  type="button"
                  key={`${c.name}-${c.stateCode}`}
                  onClick={() => selectCity(c.name, c.stateCode)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                >
                  <span>{c.name}</span>
                  {stateName && <span className="text-neutral-400 shrink-0">{stateName}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">State / Province</label>
        <input
          type="text"
          readOnly
          value={state || ''}
          placeholder="Auto-filled from city"
          className="w-full h-11 px-3 border border-neutral-300 rounded-xl text-xs bg-neutral-100 text-neutral-600 cursor-not-allowed"
        />
      </div>
    </div>
  );
};
