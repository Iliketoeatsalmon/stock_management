"use client"

import { useMemo, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { DayPicker } from "react-day-picker"
import { format, isValid, parseISO } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import "react-day-picker/dist/style.css"

type DatePickerProps = {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
  className?: string
}

const parseDate = (value?: string) => {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

export function DatePicker({ value, onChange, placeholder = "เลือกวันที่", min, max, className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = useMemo(() => parseDate(value), [value])
  const minDate = useMemo(() => parseDate(min), [min])
  const maxDate = useMemo(() => parseDate(max), [max])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${className || ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <span className={`text-sm ${value ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}
            </span>
          </div>
          <ChevronDownMini />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="start"
          className="z-50 rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"))
                setOpen(false)
              }
            }}
            fromDate={minDate}
            toDate={maxDate}
            classNames={{
              root: "relative",
              months: "flex flex-col gap-3",
              month: "space-y-3",
              caption: "flex items-center justify-between px-2 pt-2",
              caption_label: "text-sm font-semibold text-gray-900",
              nav: "flex items-center gap-2",
              nav_button:
                "h-8 w-8 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center",
              table: "w-full border-collapse",
              head_row: "grid grid-cols-7 text-xs text-gray-500 px-3",
              head_cell: "h-8 flex items-center justify-center font-medium",
              row: "grid grid-cols-7 text-sm px-3",
              cell: "h-9 flex items-center justify-center",
              day: "h-9 w-9 rounded-lg text-gray-800 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              day_selected: "bg-blue-600 text-white hover:bg-blue-600",
              day_today: "border border-blue-500 text-blue-700",
              day_outside: "text-gray-300",
              day_disabled: "text-gray-300 line-through",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ChevronDownMini() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 text-gray-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}
