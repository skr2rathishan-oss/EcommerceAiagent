import { z } from "zod";
import logger from "../utils/logger.mjs";

export const validate = (schema) => (req, res, next) => {
  try {
    // Merge params, query, and body for schema check
    const dataToValidate = {
      body: req.body,
      query: req.query,
      params: req.params
    };
    
    schema.parse(dataToValidate);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.errors.map(e => ({
        field: e.path.join("."),
        message: e.message
      }));
      logger.warn("Request input validation failed", { errors: errorDetails, path: req.originalUrl });
      return res.status(400).json({
        success: false,
        message: "Invalid input parameters.",
        errors: errorDetails
      });
    }
    next(error);
  }
};

// Input Validation Schemas
export const chatSchema = z.object({
  body: z.object({
    message: z.string({ required_error: "Message is required" })
      .trim()
      .min(1, "Message cannot be empty")
      .max(2000, "Message cannot exceed 2000 characters")
      .refine(
        val => !/system_prompt|systemPrompt|ignore previous instructions/i.test(val),
        { message: "Potential prompt injection detected" }
      ),
    sessionId: z.string().trim().max(100).optional(),
    intent: z.string().trim().max(50).optional(),
    parameters: z.record(z.any()).optional(),
    product: z.record(z.any()).optional(),
    productId: z.string().trim().optional()
  })
});

export const productDetailsSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "Product ID is required" }).trim().min(1)
  })
});

export const productInteractionSchema = z.object({
  body: z.object({
    productId: z.string({ required_error: "productId is required" }).trim().min(1),
    productName: z.string().trim().optional(),
    category: z.string().trim().optional(),
    action: z.enum(["view", "details", "add_to_cart", "purchase"], {
      required_error: "Action is required"
    })
  })
});

export const deliveryCheckSchema = z.object({
  body: z.object({
    city: z.string({ required_error: "City is required" }).trim().min(1).max(100),
    deliveryDate: z.string({ required_error: "Delivery date is required" })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Delivery date must match YYYY-MM-DD format"),
    productId: z.string().trim().nullable().optional()
  })
});

export const orderTrackingSchema = z.object({
  body: z.object({
    orderNumber: z.string({ required_error: "Order number is required" }).trim().min(1).max(50)
  })
});
