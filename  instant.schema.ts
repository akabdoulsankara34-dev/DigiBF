// instant.schema.ts
// Généré depuis l'analyse de Digitale Solution — index.html
// Collections : merchants · configs · products · clients · sales

import { i } from "@instantdb/core";

const _schema = i.schema({
  entities: {
    // ─────────────────────────────────────────────
    // MERCHANTS
    // Commerçants inscrits sur la plateforme
    // ─────────────────────────────────────────────
    merchants: i.entity({
      nom_commerce:    i.string().indexed(),    // Nom du commerce
      proprietaire:    i.string(),              // Nom du propriétaire
      telephone:       i.string().indexed().unique(), // Identifiant de connexion
      ville:           i.string(),
      type:            i.string(),              // "boutique" | "restaurant" | ...
      password:        i.string(),              // Hash (DB._hash)
      licence:         i.string(),              // "active" | "expired" | "suspended"
      licence_expiry:  i.string(),              // ISO 8601
      actif:           i.boolean().indexed(),
      created_at:      i.string(),              // ISO 8601
    }),

    // ─────────────────────────────────────────────
    // CONFIGS
    // Paramètres par marchand (1 config ↔ 1 merchant)
    // ─────────────────────────────────────────────
    configs: i.entity({
      merchant_id:     i.string().indexed(),

      // Apparence
      couleur_theme:   i.string(),              // ex: "#E8730C"
      devise:          i.string(),              // "FCFA" | "XOF" | ...

      // Messages
      message_accueil: i.string(),
      wa_message:      i.string(),              // Template WA avec {nom}, {total}, {commerce}
      wa_support:      i.string().optional(),   // Numéro WA support

      // Sécurité
      pin:             i.string().optional(),   // PIN caisse
      admin_secret:    i.string().optional(),   // Mot de passe admin panel
      token:           i.string().optional(),   // Token API admin

      // Mobile Money — Orange
      orange_num:      i.string().optional(),
      orange_ussd:     i.string().optional(),
      orange_name:     i.string().optional(),
      orange_country:  i.string().optional(),

      // Mobile Money — Moov / Flooz
      moov_num:        i.string().optional(),
      moov_ussd:       i.string().optional(),
      moov_name:       i.string().optional(),
      moov_country:    i.string().optional(),

      // Plans / licences
      plans:           i.json().optional(),

      created_at:      i.string(),              // ISO 8601
    }),

    // ─────────────────────────────────────────────
    // PRODUCTS
    // Catalogue de produits par marchand
    // ─────────────────────────────────────────────
    products: i.entity({
      merchant_id:     i.string().indexed(),
      nom:             i.string().indexed(),
      prix:            i.number(),              // Prix unitaire
      stock:           i.number().optional(),   // null = stock non géré
      categorie:       i.string().optional(),
      created_at:      i.string(),              // ISO 8601
      updated_at:      i.string().optional(),   // ISO 8601
    }),

    // ─────────────────────────────────────────────
    // CLIENTS
    // Carnet de clients par marchand
    // ─────────────────────────────────────────────
    clients: i.entity({
      merchant_id:     i.string().indexed(),
      nom:             i.string().indexed(),
      whatsapp:        i.string().optional(),   // Numéro sans espaces ni +
      created_at:      i.string(),              // ISO 8601
      updated_at:      i.string().optional(),   // ISO 8601
    }),

    // ─────────────────────────────────────────────
    // SALES
    // Ventes enregistrées à la caisse
    // ─────────────────────────────────────────────
    sales: i.entity({
      merchant_id:     i.string().indexed(),

      // Client au moment de la vente (dénormalisé pour hors-ligne)
      client_id:       i.string().optional(),   // ref → clients.id
      client_nom:      i.string(),
      client_wa:       i.string().optional(),

      // Panier — tableau sérialisé en JSON
      // Structure item : { product_id, nom, prix, qty }
      items:           i.json(),

      // Totaux
      total:           i.number(),
      devise:          i.string(),              // "FCFA" | ...

      // Cycle de vie
      statut:          i.string().indexed(),    // "pending" | "validated" | "cancelled" | "rejected"

      created_at:      i.string().indexed(),    // ISO 8601
      updated_at:      i.string().optional(),   // ISO 8601
    }),
  },

  // ─────────────────────────────────────────────
  // LINKS — Relations entre entités
  // ─────────────────────────────────────────────
  links: {
    merchantConfig: {
      forward: { on: "configs",  field: "merchant",  label: "merchant" },
      reverse: { on: "merchants", field: "config",   label: "config"  },
    },
    merchantProducts: {
      forward: { on: "products", field: "merchant",  label: "merchant" },
      reverse: { on: "merchants", field: "products", label: "products" },
    },
    merchantClients: {
      forward: { on: "clients",  field: "merchant",  label: "merchant" },
      reverse: { on: "merchants", field: "clients",  label: "clients"  },
    },
    merchantSales: {
      forward: { on: "sales",    field: "merchant",  label: "merchant" },
      reverse: { on: "merchants", field: "sales",    label: "sales"    },
    },
    saleClient: {
      forward: { on: "sales",   field: "client",    label: "client"   },
      reverse: { on: "clients", field: "sales",     label: "sales"    },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
export type Schema = typeof _schema;
export default _schema;

// ─────────────────────────────────────────────────────────────────────────────
// Types utilitaires inférés
// ─────────────────────────────────────────────────────────────────────────────
export type Merchant = Schema["entities"]["merchants"];
export type Config   = Schema["entities"]["configs"];
export type Product  = Schema["entities"]["products"];
export type Client   = Schema["entities"]["clients"];
export type Sale     = Schema["entities"]["sales"];

// Type pour un article dans le panier (items d'une vente)
export interface SaleItem {
  product_id: string;
  nom:        string;
  prix:       number;
  qty:        number;
}
