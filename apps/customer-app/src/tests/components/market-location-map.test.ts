import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketLocationMap from "@/components/markets/MarketLocationMap.vue";
import { loadMarketMapRuntime } from "@/components/markets/mapRuntime";
import type { MarketDetail, MarketVendor } from "@/services/marketsApi";

const mapRemove = vi.hoisted(() => vi.fn());
const mapOn = vi.hoisted(() => vi.fn());
const mapAddSource = vi.hoisted(() => vi.fn());
const mapAddLayer = vi.hoisted(() => vi.fn());
const mapFitBounds = vi.hoisted(() => vi.fn());
const mapAddControl = vi.hoisted(() => vi.fn());
const mapResize = vi.hoisted(() => vi.fn());
const markerSetLngLat = vi.hoisted(() => vi.fn().mockReturnThis());
const markerSetPopup = vi.hoisted(() => vi.fn().mockReturnThis());
const markerAddTo = vi.hoisted(() => vi.fn().mockReturnThis());
const popupSetText = vi.hoisted(() => vi.fn().mockReturnThis());
const addProtocol = vi.hoisted(() => vi.fn());
const protocolTile = vi.hoisted(() => vi.fn());
const maplibreMock = vi.hoisted(() => ({
  Map: vi.fn().mockImplementation(() => ({
    on: mapOn,
    addSource: mapAddSource,
    addLayer: mapAddLayer,
    fitBounds: mapFitBounds,
    addControl: mapAddControl,
    resize: mapResize,
    remove: mapRemove,
  })),
  Marker: vi.fn().mockImplementation(() => ({
    setLngLat: markerSetLngLat,
    setPopup: markerSetPopup,
    addTo: markerAddTo,
  })),
  Popup: vi.fn().mockImplementation(() => ({
    setText: popupSetText,
  })),
  NavigationControl: vi.fn(),
  LngLatBounds: vi.fn().mockImplementation(() => ({
    extend: vi.fn().mockReturnThis(),
  })),
  addProtocol,
}));

vi.mock("@/components/markets/mapRuntime", () => ({
  loadMarketMapRuntime: vi.fn(),
}));

function market(overrides: Partial<MarketDetail> = {}): MarketDetail {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    description: null,
    city: "台中市",
    district: "西屯區",
    address: "文華路",
    latitude: 24.1764,
    longitude: 120.6466,
    bannerUrl: null,
    logoUrl: null,
    tags: null,
    vendorCount: 1,
    ...overrides,
  };
}

function vendor(overrides: Partial<MarketVendor> = {}): MarketVendor {
  return {
    restaurantId: "restaurant-1",
    name: "雞排攤",
    type: "market_stall",
    district: "西屯區",
    priceRange: null,
    rating: null,
    isOpen: true,
    supportsTakeaway: true,
    supportsDelivery: false,
    imageUrl: null,
    latitude: 24.1765,
    longitude: 120.6467,
    stallNumber: "A-01",
    isPrimary: true,
    availableMenuItemCount: 3,
    publicServiceItemCount: 1,
    ...overrides,
  };
}

describe("MarketLocationMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maplibreMock.Map.mockImplementation(() => ({
      on: mapOn,
      addSource: mapAddSource,
      addLayer: mapAddLayer,
      fitBounds: mapFitBounds,
      addControl: mapAddControl,
      resize: mapResize,
      remove: mapRemove,
    }));
    maplibreMock.Marker.mockImplementation(() => {
      const marker = {
        setLngLat: (value: [number, number]) => {
          markerSetLngLat(value);
          return marker;
        },
        setPopup: (value: unknown) => {
          markerSetPopup(value);
          return marker;
        },
        addTo: (value: unknown) => {
          markerAddTo(value);
          return marker;
        },
      };
      return marker;
    });
    maplibreMock.Popup.mockImplementation(() => {
      const popup = {
        setText: (value: string) => {
          popupSetText(value);
          return popup;
        },
      };
      return popup;
    });
    maplibreMock.LngLatBounds.mockImplementation(() => ({
      extend: vi.fn().mockReturnThis(),
    }));
    vi.mocked(loadMarketMapRuntime).mockResolvedValue({
      maplibregl: maplibreMock as never,
      registerPmTilesProtocol: () => addProtocol("pmtiles", protocolTile),
    });
  });

  it("renders market map shell with navigation link", () => {
    const wrapper = mount(MarketLocationMap, {
      props: {
        market: market(),
        vendors: [vendor()],
      },
    });

    expect(wrapper.get('[data-testid="market-location-map"]').text()).toContain(
      "市場位置",
    );
    expect(wrapper.get('[data-testid="market-location-address"]').text()).toBe(
      "文華路",
    );
    expect(
      wrapper
        .get('[data-testid="market-location-navigation"]')
        .attributes("href"),
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=24.1764%2C120.6466",
    );
  });

  it("initializes maplibre and plots market boundary plus vendor markers", async () => {
    mapOn.mockImplementation((event: string, callback: () => void) => {
      if (event === "load") callback();
    });
    mount(MarketLocationMap, {
      props: {
        market: market({
          boundaryGeojson: {
            type: "Polygon",
            coordinates: [
              [
                [120.646, 24.176],
                [120.647, 24.176],
                [120.647, 24.177],
                [120.646, 24.177],
                [120.646, 24.176],
              ],
            ],
          },
        }),
        vendors: [
          vendor(),
          vendor({ restaurantId: "missing-coordinates", latitude: null }),
        ],
      },
    });
    await vi.dynamicImportSettled();

    expect(addProtocol).toHaveBeenCalledWith("pmtiles", expect.any(Function));
    expect(mapAddSource).toHaveBeenCalledWith(
      "market-boundary",
      expect.objectContaining({
        type: "geojson",
      }),
    );
    expect(mapAddLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "market-boundary-fill",
        type: "fill",
      }),
    );
    expect(markerSetLngLat).toHaveBeenCalledWith([120.6466, 24.1764]);
    expect(markerSetLngLat).toHaveBeenCalledWith([120.6467, 24.1765]);
    expect(markerSetLngLat).toHaveBeenCalledTimes(2);
  });

  it("removes the map instance on unmount", async () => {
    mapOn.mockImplementation((event: string, callback: () => void) => {
      if (event === "load") callback();
    });
    const wrapper = mount(MarketLocationMap, {
      props: {
        market: market(),
        vendors: [vendor()],
      },
    });
    await vi.dynamicImportSettled();

    wrapper.unmount();

    expect(mapRemove).toHaveBeenCalled();
  });
});
