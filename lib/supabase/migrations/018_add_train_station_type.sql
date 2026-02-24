-- Add train_station to transport_stops stop_type check constraint
ALTER TABLE transport_stops DROP CONSTRAINT IF EXISTS transport_stops_stop_type_check;
ALTER TABLE transport_stops ADD CONSTRAINT transport_stops_stop_type_check
  CHECK (stop_type IN ('trotro_stop', 'bus_stop', 'lorry_park', 'taxi_rank', 'train_station'));
