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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase";

const watchlistSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").transform((s) => s.toUpperCase()),
  target_price: z.coerce.number().min(0).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string().optional(),
});

type WatchlistFormData = z.infer<typeof watchlistSchema>;

interface WatchlistFormProps {
  onSuccess?: () => void;
}

export function WatchlistForm({ onSuccess }: WatchlistFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<WatchlistFormData>({
    resolver: zodResolver(watchlistSchema),
    defaultValues: {
      symbol: "",
      target_price: undefined,
      priority: "MEDIUM",
      reason: "",
    },
  });

  const onSubmit = async (data: WatchlistFormData) => {
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("watchlists").insert({
        user_id: user.id,
        symbol: data.symbol.toUpperCase(),
        target_price: data.target_price || null,
        priority: data.priority,
        reason: data.reason || null,
      });

      if (error) throw error;

      toast.success("Added to watchlist");
      reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add to watchlist");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add to Watchlist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Watchlist</DialogTitle>
          <DialogDescription>Add a stock to your watchlist to track it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="AAPL"
                {...register("symbol")}
                onChange={(e) => {
                  register("symbol").onChange(e);
                  setValue("symbol", e.target.value.toUpperCase());
                }}
              />
              {errors.symbol && <p className="text-xs text-red-500">{errors.symbol.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                defaultValue="MEDIUM"
                onValueChange={(v) => setValue("priority", v as "HIGH" | "MEDIUM" | "LOW")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                  <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                  <SelectItem value="LOW">LOW</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_price">Target Price ($)</Label>
            <Input
              id="target_price"
              type="number"
              step="any"
              placeholder="Optional target price"
              {...register("target_price")}
            />
            {errors.target_price && <p className="text-xs text-red-500">{errors.target_price.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Why are you watching this stock?"
              {...register("reason")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Add to Watchlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
