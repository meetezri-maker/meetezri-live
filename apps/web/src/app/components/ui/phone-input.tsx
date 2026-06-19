import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "./utils"
import { Button } from "./button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { Input } from "./input"

const countries = [
  { value: "+1", label: "United States (+1)", code: "US", flag: "🇺🇸" },
  { value: "+44", label: "United Kingdom (+44)", code: "GB", flag: "🇬🇧" },
  { value: "+91", label: "India (+91)", code: "IN", flag: "🇮🇳" },
  { value: "+61", label: "Australia (+61)", code: "AU", flag: "🇦🇺" },
  { value: "+81", label: "Japan (+81)", code: "JP", flag: "🇯🇵" },
  { value: "+49", label: "Germany (+49)", code: "DE", flag: "🇩🇪" },
  { value: "+33", label: "France (+33)", code: "FR", flag: "🇫🇷" },
  { value: "+86", label: "China (+86)", code: "CN", flag: "🇨🇳" },
  { value: "+55", label: "Brazil (+55)", code: "BR", flag: "🇧🇷" },
  { value: "+7", label: "Russia (+7)", code: "RU", flag: "🇷🇺" },
  { value: "+39", label: "Italy (+39)", code: "IT", flag: "🇮🇹" },
  { value: "+1", label: "Canada (+1)", code: "CA", flag: "🇨🇦" },
  { value: "+971", label: "UAE (+971)", code: "AE", flag: "🇦🇪" },
  { value: "+966", label: "Saudi Arabia (+966)", code: "SA", flag: "🇸🇦" },
  { value: "+92", label: "Pakistan (+92)", code: "PK", flag: "🇵🇰" },
  { value: "+65", label: "Singapore (+65)", code: "SG", flag: "🇸🇬" },
  { value: "+60", label: "Malaysia (+60)", code: "MY", flag: "🇲🇾" },
  { value: "+62", label: "Indonesia (+62)", code: "ID", flag: "🇮🇩" },
  { value: "+63", label: "Philippines (+63)", code: "PH", flag: "🇵🇭" },
  { value: "+64", label: "New Zealand (+64)", code: "NZ", flag: "🇳🇿" },
  { value: "+27", label: "South Africa (+27)", code: "ZA", flag: "🇿🇦" },
  { value: "+20", label: "Egypt (+20)", code: "EG", flag: "🇪🇬" },
  { value: "+90", label: "Turkey (+90)", code: "TR", flag: "🇹🇷" },
  { value: "+82", label: "South Korea (+82)", code: "KR", flag: "🇰🇷" },
  { value: "+34", label: "Spain (+34)", code: "ES", flag: "🇪🇸" },
  { value: "+31", label: "Netherlands (+31)", code: "NL", flag: "🇳🇱" },
  { value: "+41", label: "Switzerland (+41)", code: "CH", flag: "🇨🇭" },
  { value: "+46", label: "Sweden (+46)", code: "SE", flag: "🇸🇪" },
  { value: "+47", label: "Norway (+47)", code: "NO", flag: "🇳🇴" },
  { value: "+48", label: "Poland (+48)", code: "PL", flag: "🇵🇱" },
  { value: "+32", label: "Belgium (+32)", code: "BE", flag: "🇧🇪" },
  { value: "+43", label: "Austria (+43)", code: "AT", flag: "🇦🇹" },
  { value: "+30", label: "Greece (+30)", code: "GR", flag: "🇬🇷" },
  { value: "+351", label: "Portugal (+351)", code: "PT", flag: "🇵🇹" },
  { value: "+353", label: "Ireland (+353)", code: "IE", flag: "🇮🇪" },
  { value: "+420", label: "Czech Republic (+420)", code: "CZ", flag: "🇨🇿" },
  { value: "+36", label: "Hungary (+36)", code: "HU", flag: "🇭🇺" },
  { value: "+40", label: "Romania (+40)", code: "RO", flag: "🇷🇴" },
  { value: "+380", label: "Ukraine (+380)", code: "UA", flag: "🇺🇦" },
  { value: "+972", label: "Israel (+972)", code: "IL", flag: "🇮🇱" },
  { value: "+98", label: "Iran (+98)", code: "IR", flag: "🇮🇷" },
  { value: "+964", label: "Iraq (+964)", code: "IQ", flag: "🇮🇶" },
  { value: "+234", label: "Nigeria (+234)", code: "NG", flag: "🇳🇬" },
  { value: "+254", label: "Kenya (+254)", code: "KE", flag: "🇰🇪" },
  { value: "+233", label: "Ghana (+233)", code: "GH", flag: "🇬🇭" },
  { value: "+52", label: "Mexico (+52)", code: "MX", flag: "🇲🇽" },
  { value: "+54", label: "Argentina (+54)", code: "AR", flag: "🇦🇷" },
  { value: "+56", label: "Chile (+56)", code: "CL", flag: "🇨🇱" },
  { value: "+57", label: "Colombia (+57)", code: "CO", flag: "🇨🇴" },
  { value: "+51", label: "Peru (+51)", code: "PE", flag: "🇵🇪" },
  { value: "+45", label: "Denmark (+45)", code: "DK", flag: "🇩🇰" },
  { value: "+358", label: "Finland (+358)", code: "FI", flag: "🇫🇮" },
  { value: "+852", label: "Hong Kong (+852)", code: "HK", flag: "🇭🇰" },
  { value: "+974", label: "Qatar (+974)", code: "QA", flag: "🇶🇦" },
  { value: "+965", label: "Kuwait (+965)", code: "KW", flag: "🇰🇼" },
  { value: "+961", label: "Lebanon (+961)", code: "LB", flag: "🇱🇧" },
  { value: "+256", label: "Uganda (+256)", code: "UG", flag: "🇺🇬" },
  { value: "+880", label: "Bangladesh (+880)", code: "BD", flag: "🇧🇩" },
  { value: "+94", label: "Sri Lanka (+94)", code: "LK", flag: "🇱🇰" },
  { value: "+66", label: "Thailand (+66)", code: "TH", flag: "🇹🇭" },
  { value: "+58", label: "Venezuela (+58)", code: "VE", flag: "🇻🇪" },
]

export interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  /** Called when user selects a country dial code (ISO alpha-2, e.g. PK). */
  onCountryCodeChange?: (countryCode: string) => void
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  name?: string
  id?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  inputClassName?: string
  placeholder?: string
  /** Dark sanctuary styling for the country dropdown panel */
  popoverClassName?: string
  commandClassName?: string
  commandInputClassName?: string
  commandListClassName?: string
  commandItemClassName?: string
  commandEmptyClassName?: string
}

const MAX_PHONE_DIGITS = 12

const countDigits = (value: string) => (value.match(/\d/g) || []).length

const limitLocalPhoneDigits = (value: string, countryCode: string) => {
  const allowedDigits = Math.max(0, MAX_PHONE_DIGITS - countDigits(countryCode))
  let localDigits = 0
  let limitedValue = ""

  for (const char of value) {
    if (/\d/.test(char)) {
      if (localDigits >= allowedDigits) continue
      localDigits += 1
    }
    limitedValue += char
  }

  return limitedValue
}

export function PhoneInput({
  value = "",
  onChange,
  onCountryCodeChange,
  onBlur,
  name,
  id,
  disabled,
  className,
  buttonClassName,
  inputClassName,
  placeholder,
  popoverClassName,
  commandClassName,
  commandInputClassName,
  commandListClassName,
  commandItemClassName,
  commandEmptyClassName,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedCountry = React.useMemo(() => {
    if (!value) return countries[0]
    const sortedCountries = [...countries].sort((a, b) => b.value.length - a.value.length)
    return sortedCountries.find((c) => value.startsWith(c.value)) || countries[0]
  }, [value])

  const [phoneNumber, setPhoneNumber] = React.useState("")

  React.useEffect(() => {
    if (document.activeElement === inputRef.current) return

    if (value) {
      if (value.startsWith(selectedCountry.value)) {
        setPhoneNumber(value.slice(selectedCountry.value.length))
      } else {
        setPhoneNumber(value)
      }
    } else {
      setPhoneNumber("")
    }
  }, [value, selectedCountry.value])

  const handleCountrySelect = (currentValue: string) => {
    const newCountry = countries.find((c) => c.value === currentValue) || countries[0]
    setOpen(false)
    const limitedNumber = limitLocalPhoneDigits(phoneNumber, newCountry.value)
    setPhoneNumber(limitedNumber)
    onCountryCodeChange?.(newCountry.code)
    if (onChange) {
      onChange(newCountry.value + limitedNumber)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNumber = e.target.value.replace(/[^0-9\s\-()]/g, "") // digits and common formatting only; + is handled by the dropdown
    const limitedNumber = limitLocalPhoneDigits(newNumber, selectedCountry.value)
    
    setPhoneNumber(limitedNumber)
    if (onChange) {
      onChange(selectedCountry.value + limitedNumber)
    }
  }

  return (
    <div className={cn("flex w-full min-w-0 gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-[120px] shrink-0 justify-between px-3 sm:w-[140px]", buttonClassName)}
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <span>{selectedCountry.flag}</span>
              <span>{selectedCountry.value}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "z-[200] w-[300px] overflow-visible rounded-xl p-1 pb-0",
            popoverClassName,
          )}
          side="bottom"
          align="start"
          sideOffset={8}
          avoidCollisions
          collisionPadding={16}
        >
          <Command className={commandClassName}>
            <CommandInput
              placeholder="Search country..."
              className={commandInputClassName}
            />
            <CommandList className={commandListClassName}>
              <CommandEmpty className={commandEmptyClassName}>
                No country found.
              </CommandEmpty>
              <CommandGroup>
                {countries.map((country) => (
                  <CommandItem
                    key={country.code + country.value}
                    value={country.label} // Search by label
                    className={commandItemClassName}
                    onSelect={() => handleCountrySelect(country.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCountry.value === country.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2 text-lg">{country.flag}</span>
                    {country.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={phoneNumber}
        onChange={handlePhoneChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder || "Phone number"}
        className={cn("min-w-0 flex-1", inputClassName)}
      />
    </div>
  )
}
