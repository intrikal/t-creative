/**
 * Tests for LocationsTab — admin location management UI.
 *
 * Verifies rendering, create dialog, inline editing, and active/inactive toggle.
 * Server actions are mocked to isolate component behavior.
 *
 * @module settings/components/LocationsTab.test
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LocationRow } from "../../location-actions";

/* ---- Mock server actions ---- */

const mockCreateLocation = vi.fn();
const mockUpdateLocation = vi.fn();

vi.mock("../../location-actions", () => ({
  createLocation: (...args: unknown[]) => mockCreateLocation(...args),
  updateLocation: (...args: unknown[]) => mockUpdateLocation(...args),
}));

/* ---- Test fixtures ---- */

const now = new Date().toISOString();

function makeLocation(overrides: Partial<LocationRow> = {}): LocationRow {
  return {
    id: 1,
    name: "Downtown Studio",
    address: "123 Main St",
    city: "Los Angeles",
    timezone: "America/Los_Angeles",
    phone: "(555) 111-2222",
    email: "downtown@studio.com",
    squareLocationId: "sq_abc",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const activeLocation = makeLocation();
const inactiveLocation = makeLocation({
  id: 2,
  name: "Westside Studio",
  address: "456 Ocean Ave",
  city: "Santa Monica",
  isActive: false,
});

/* ---- Setup ---- */

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateLocation.mockResolvedValue(makeLocation({ id: 99, name: "New Location" }));
  mockUpdateLocation.mockResolvedValue(activeLocation);
});

/* ---- Lazy import (after mocks) ---- */

async function renderTab(locations: LocationRow[] = [activeLocation, inactiveLocation]) {
  const { LocationsTab } = await import("./LocationsTab");
  return render(<LocationsTab initial={locations} />);
}

/* ---- Tests ---- */

describe("LocationsTab", () => {
  describe("rendering", () => {
    it("displays all locations", async () => {
      await renderTab();
      expect(screen.getByText("Downtown Studio")).toBeInTheDocument();
      expect(screen.getByText("Westside Studio")).toBeInTheDocument();
    });

    it("shows active/inactive badges", async () => {
      await renderTab();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("shows address and city", async () => {
      await renderTab();
      expect(screen.getByText("123 Main St, Los Angeles")).toBeInTheDocument();
      expect(screen.getByText("456 Ocean Ave, Santa Monica")).toBeInTheDocument();
    });

    it("shows location count summary", async () => {
      await renderTab();
      expect(screen.getByText("1 active of 2 total")).toBeInTheDocument();
    });

    it("shows empty state when no locations", async () => {
      await renderTab([]);
      expect(
        screen.getByText("No locations yet. Add your first studio location."),
      ).toBeInTheDocument();
    });
  });

  describe("add dialog", () => {
    it("opens when Add Location is clicked", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Add Location"));
      expect(screen.getByText("New Location")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g. Downtown Studio")).toBeInTheDocument();
    });

    it("closes on Cancel", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Add Location"));
      expect(screen.getByText("New Location")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("New Location")).not.toBeInTheDocument();
    });

    it("submits creation form", async () => {
      await renderTab([]);

      fireEvent.click(screen.getByText("Add Location"));

      const nameInput = screen.getByPlaceholderText("e.g. Downtown Studio");
      fireEvent.change(nameInput, { target: { value: "New Location" } });

      const addressInput = screen.getByPlaceholderText("Street address");
      fireEvent.change(addressInput, { target: { value: "789 New Ave" } });

      await act(async () => {
        fireEvent.submit(screen.getByText("Create").closest("form")!);
      });

      expect(mockCreateLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Location",
          address: "789 New Ave",
          timezone: "America/Los_Angeles",
        }),
      );
    });
  });

  describe("inline editing", () => {
    it("expands edit form when location card is clicked", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Downtown Studio"));
      const saveButtons = screen.getAllByText("Save");
      expect(saveButtons.length).toBeGreaterThan(0);
    });

    it("collapses edit form when clicked again", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Downtown Studio"));
      expect(screen.getByText("Save")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Downtown Studio"));
      expect(screen.queryByText("Save")).not.toBeInTheDocument();
    });

    it("submits update on save", async () => {
      await renderTab();
      fireEvent.click(screen.getByText("Downtown Studio"));

      const nameInput = screen.getByDisplayValue("Downtown Studio");
      fireEvent.change(nameInput, { target: { value: "Updated Studio" } });

      await act(async () => {
        fireEvent.submit(screen.getByText("Save").closest("form")!);
      });

      expect(mockUpdateLocation).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "Updated Studio" }),
      );
    });
  });

  describe("active/inactive toggle", () => {
    it("renders toggle switches for each location", async () => {
      await renderTab();
      const toggles = screen.getAllByRole("switch");
      expect(toggles).toHaveLength(2);
    });

    it("calls updateLocation with toggled isActive", async () => {
      await renderTab();
      const toggles = screen.getAllByRole("switch");

      await act(async () => {
        fireEvent.click(toggles[0]);
      });

      expect(mockUpdateLocation).toHaveBeenCalledWith(1, { isActive: false });
    });

    it("toggles inactive location to active", async () => {
      await renderTab();
      const toggles = screen.getAllByRole("switch");

      await act(async () => {
        fireEvent.click(toggles[1]);
      });

      expect(mockUpdateLocation).toHaveBeenCalledWith(2, { isActive: true });
    });
  });
});
