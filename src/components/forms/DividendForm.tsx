"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase";

const dividendSchema = z.object({
  date: z.string().min(1, "Date is required"),
  symbol: z.string().min(1, "Symbol is required").transform((s) => s.toUpperCase()),
  amount: z.coerce.number().positive("Amount must be positive"),
  tax_withheld: z.coerce.number().min(0, "Tax cannot be negative").optional(),
  notes: z.string().optional(),
});

type DividendFormData = z.infer<typeof dividendSchema>;

interface DividendFormProps {
  onSuccess?: () => void;
}

export function DividendForm({ onSuccess }: DividendFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DividendFormData>({
    resolver: zodResolver(dividendSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      symbol: "",
      amount: undefined as unknown as number,
      tax_withheld: 0,
      notes: "",
    },
  });

  const onSubmit = async (data: DividendFormData) => {
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("dividends").insert({
        user_id: user.id,
        date: data.date,
        symbol: data.symbol,
        amount: data.amount,
        tax_withheld: data.tax_withheld || 0,
        notes: data.notes || null,
      });

      if (error) throw error;

      toast.success("Dividend added successfully");
      reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add dividend");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Dividend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Dividend</DialogTitle>
          <DialogDescription>Record a dividend payment received.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="AAPL"
                {...register("symbol")}
              />
              {errors.symbol && <p className="text-xs text-red-500">{errors.symbol.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="100.00"
                {...register("amount")}
              />
              {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_withheld">Tax Withheld ($)</Label>
              <Input
                id="tax_withheld"
                type="number"
                step="any"
                placeholder="0.00"
                {...register("tax_withheld")}
              />
              {errors.tax_withheld && <p className="text-xs text-red-500">{errors.tax_withheld.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes..."
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Dividend"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
