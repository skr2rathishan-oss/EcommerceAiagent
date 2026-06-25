import { useState } from "react";

const API_BASE = "/api/delivery/concierge";

export interface Address {
  _id?: string;
  label: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  province?: string;
  postalCode?: string;
  isDefault: boolean;
}

export function useConcierge(sessionId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = async (): Promise<Address[]> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/addresses/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch addresses");
      return data.addresses || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const saveAddress = async (addressData: Address): Promise<Address[]> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/addresses/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save address");
      return data.addresses || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const checkDelivery = async (city: string, deliveryDate: string, productId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, deliveryDate, productId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check delivery");
      return data;
    } catch (err: any) {
      setError(err.message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const checkNearestArea = async (city: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/nearest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to find nearest area");
      return data.nearest;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchAddresses,
    saveAddress,
    checkDelivery,
    checkNearestArea
  };
}
