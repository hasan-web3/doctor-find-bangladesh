"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Helper to get today's date in a consistent, local-timezone format.
const todayIso = () => {
  const dt = new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

interface BookingContextType {
  // Step 1 state
  step: number;
  setStep: (step: number) => void;
  date: string;
  setDate: (date: string) => void;
  slot: string;
  setSlot: (slot: string) => void;
  chamberId: number | null;
  setChamberId: (id: number | null) => void;
  
  // Step 2 state
  patientName: string;
  setPatientName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  age: string;
  setAge: (age: string) => void;
  problem: string;
  setProblem: (problem: string) => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(todayIso());
  const [slot, setSlot] = useState("");
  const [chamberId, setChamberId] = useState<number | null>(null);
  
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [problem, setProblem] = useState("");

  const value = {
    step, setStep,
    date, setDate,
    slot, setSlot,
    chamberId, setChamberId,
    patientName, setPatientName,
    phone, setPhone,
    age, setAge,
    problem, setProblem,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBookingContext() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBookingContext must be used within a BookingProvider");
  }
  return context;
}
