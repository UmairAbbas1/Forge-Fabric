import React, { useState, useEffect } from 'react';
import { Phone, ChevronDown } from 'lucide-react';

export interface CountryOption {
  code: string;       // ISO 2-letter country code
  name: string;       // Country display name
  dialCode: string;   // Dial code e.g. +92
  flag: string;       // Emoji flag symbol
  mask: string;       // Phone mask template e.g. (###) ###-####
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', mask: '(###) ###-####' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', mask: '(###) ###-####' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', mask: '#### ######' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', mask: '### #######' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', mask: '##### #####' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', mask: '#### ######' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', mask: '### ### ####' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', mask: '#### ########' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', mask: '# ## ## ## ##' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', mask: '### #######' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', mask: '### ### ###' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', mask: '# ### ####' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', mask: '# #### ####' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', mask: '### #### ####' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', mask: '## #### ####' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', mask: '## #### ####' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', mask: '### ### ###' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', mask: '## ### ####' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', mask: '(##) #####-####' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', mask: '### ### ####' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳', mask: '### ### ####' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', mask: '### #### ####' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', mask: '##-### ####' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭', mask: '### ### ####' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭', mask: '## ### ####' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', mask: '#### ####' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', mask: '## ########' },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', mask: '## ### ## ##' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', mask: '## ### ## ##' },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', mask: '### ## ###' },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', mask: '## ## ## ##' },
  { code: 'FI', name: 'Finland', dialCode: '+358', flag: '🇫🇮', mask: '## ### ####' },
  { code: 'PL', name: 'Poland', dialCode: '+48', flag: '🇵🇱', mask: '### ### ###' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', mask: '## ### ####' },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', mask: '### #######' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪', mask: '## #######' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', flag: '🇪🇬', mask: '## #### ####' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', mask: '## ### ####' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', mask: '### ### ####' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', mask: '### ######' },
  { code: 'MA', name: 'Morocco', dialCode: '+212', flag: '🇲🇦', mask: '##-########' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', mask: '### ###-####' },
  { code: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', mask: '# #### ####' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', mask: '### ### ####' },
  { code: 'PE', name: 'Peru', dialCode: '+51', flag: '🇵🇪', mask: '### ### ###' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼', mask: '### ### ###' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰', mask: '#### ####' },
];

interface CountryPhoneInputProps {
  value?: string;
  onChange: (formattedValue: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  selectedCountryName?: string; // Optional link to parent address country name
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value = '',
  onChange,
  placeholder = 'Phone number',
  className = '',
  required = false,
  selectedCountryName,
}) => {
  // Find default matching country by parent address or default to US
  const initialCountry = COUNTRY_OPTIONS.find(
    (c) => selectedCountryName && c.name.toLowerCase() === selectedCountryName.toLowerCase()
  ) || COUNTRY_OPTIONS[0];

  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(initialCountry);
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Update country selection when parent address country changes
  useEffect(() => {
    if (selectedCountryName) {
      const match = COUNTRY_OPTIONS.find(
        (c) => c.name.toLowerCase() === selectedCountryName.toLowerCase()
      );
      if (match) {
        setSelectedCountry(match);
      }
    }
  }, [selectedCountryName]);

  // Parse initial value if provided with dial code
  useEffect(() => {
    if (value) {
      const matchedDial = COUNTRY_OPTIONS.find((c) => value.startsWith(c.dialCode));
      if (matchedDial) {
        setSelectedCountry(matchedDial);
        const rawDigits = value.replace(matchedDial.dialCode, '').trim();
        setPhoneNumber(rawDigits);
      } else {
        setPhoneNumber(value);
      }
    }
  }, []);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const country = COUNTRY_OPTIONS.find((c) => c.code === code) || COUNTRY_OPTIONS[0];
    setSelectedCountry(country);
    
    // Notify parent with new country prefix
    const fullValue = phoneNumber ? `${country.dialCode} ${phoneNumber}` : `${country.dialCode} `;
    onChange(fullValue);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    // Allow digits, spaces, hyphens, and parentheses
    const cleaned = inputVal.replace(/[^\d\s()-]/g, '');
    setPhoneNumber(cleaned);

    const fullValue = cleaned ? `${selectedCountry.dialCode} ${cleaned}` : '';
    onChange(fullValue);
  };

  return (
    <div className="relative flex items-center">
      {/* Country Dial Selector */}
      <div className="relative flex items-center shrink-0 border-r border-neutral-300 bg-neutral-100 hover:bg-neutral-200 rounded-l-xl transition-all">
        <span className="pl-3 text-base leading-none">{selectedCountry.flag}</span>
        <select
          value={selectedCountry.code}
          onChange={handleCountryChange}
          className="appearance-none bg-transparent py-2.5 pl-2 pr-6 text-xs font-bold text-neutral-800 cursor-pointer focus:outline-none"
        >
          {COUNTRY_OPTIONS.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.dialCode} ({country.code})
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none text-neutral-500" />
      </div>

      {/* Phone Number Input */}
      <div className="relative flex-1">
        <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="tel"
          required={required}
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder={placeholder || selectedCountry.mask}
          className={`w-full h-11 pl-9 pr-3 rounded-r-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        />
      </div>
    </div>
  );
};
