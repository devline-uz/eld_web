# features/trailers

Trailer inventory (`GET/POST /trailers`, `PATCH/DELETE /trailers/:id`, `/trailers/import`, `/trailers/export`),
gated by the `vehicles` permission key (the backend has no separate trailer key).

The backend `Trailer` row is `{ id, number (unique), vin?, status }` — there are no plate, make or
model columns, so the table does not invent them. `GET /trailers` takes no params, so search and
paging run in memory over the one cached list shared with the Create trip trailer picker.

Rules: this folder never imports another `features/*`; URLs live in `shared/api/endpoints.ts`.
