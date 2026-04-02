"use server";

// This file is intentionally thin. The implementation has been split into
// focused modules under actions/. Re-export everything so any existing
// import that resolves to this file continues to work unchanged.
export * from "./actions/index";
