"use client";

import { useActionState } from "react";
import { type FindEventState, findEvent } from "@/app/actions";
import { inputClass, primaryButtonClass } from "./ui";

const initial: FindEventState = { error: null, value: "" };

export function EventFinder() {
  const [state, action, pending] = useActionState(findEvent, initial);
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-2">
      <label htmlFor="event" className="text-sm font-medium">
        Event link or SKU
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="event"
          name="event"
          defaultValue={state.value}
          placeholder="Paste an events.vex.com link or RE-V5RC-26-4531"
          className={inputClass}
          autoComplete="off"
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "event-error" : undefined}
        />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Opening" : "Open event"}
        </button>
      </div>
      {state.error ? (
        <p id="event-error" role="alert" className="text-sm text-alliance-red">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
