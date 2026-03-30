-- Seed commuter tips — approved, ready to display
INSERT INTO public.commuter_tips (tip, author_name, device_id, category, upvotes, is_approved) VALUES

-- Trotro tips
('The 5:30 AM Express from Madina usually has plenty of window seats. Perfect for a quiet morning.', 'Ama K.', 'seed', 'trotro', 12, true),
('Avoid the Circle interchange between 5-6 PM. Take the Kaneshie route instead — faster by 20 mins.', 'Kojo B.', 'seed', 'trotro', 18, true),
('Trotro fares from Tema go up by ₵2 during peak hours. Travel before 6 AM to save.', 'Esi M.', 'seed', 'trotro', 15, true),
('The Kasoa-Kaneshie route has more vehicles on Mondays. Queue is usually shorter.', 'Kwaku D.', 'seed', 'trotro', 9, true),
('If you''re going from Lapaz to Accra Mall, take the Achimota-Tetteh Quarshie trotro — faster than going through Circle.', 'Akua N.', 'seed', 'trotro', 14, true),
('Trotros from Madina to Legon are fastest between 9-10 AM after the morning rush clears.', 'Yaw S.', 'seed', 'trotro', 7, true),
('Kaneshie to Kasoa fare is cheaper if you board from the main station, not roadside.', 'Efua R.', 'seed', 'trotro', 11, true),
('Early morning Dansoman-Circle trotros fill up fast. Arrive before 5:45 AM for a seat.', 'Kofi A.', 'seed', 'trotro', 8, true),

-- Train tips
('Train from Tema departs sharp at 6 AM. Arrive 10 mins early — it doesn''t wait.', 'Nana A.', 'seed', 'train', 22, true),
('Mpakadan train has scenic river views after Akosombo. Try to sit on the left side.', 'Yaw P.', 'seed', 'train', 16, true),
('The Tema-Accra afternoon train (4:30 PM) is usually less crowded than the morning.', 'Maame B.', 'seed', 'train', 10, true),
('Buy your train ticket at the station counter — no middlemen, no markups. Official GRDA price only.', 'Fiifi T.', 'seed', 'train', 13, true),
('Tema Station has a small canteen by the platform. Grab water before the ride — no vendors on board.', 'Adwoa K.', 'seed', 'train', 6, true),

-- GPRTU tips
('GPRTU-verified fares are always displayed at the station. Check before boarding to avoid overcharges.', 'GPRTU', 'seed', 'gprtu', 25, true),
('If a trotro mate quotes a higher fare than what''s posted, you can report it on Troski.', 'Adjoa F.', 'seed', 'gprtu', 20, true),
('GPRTU stations have official loading points. Boarding from there means fair pricing and registered vehicles.', 'GPRTU', 'seed', 'gprtu', 17, true),
('Always collect your change before the trotro moves. It''s harder to sort out mid-journey.', 'Kwesi M.', 'seed', 'gprtu', 14, true),

-- Safety tips
('Share your live trip with a friend using GO Mode. They can track your trotro in real time.', 'Troski', 'seed', 'safety', 19, true),
('Avoid sitting near the door on crowded trotros — pickpockets target the exit during stops.', 'Serwaa D.', 'seed', 'safety', 21, true),
('If you''re travelling late, always save your emergency contact in Troski. One tap sends an SOS with your location.', 'Troski', 'seed', 'safety', 16, true),

-- General tips
('Report your fare after every ride. The more data we have, the better fares get for everyone.', 'Troski', 'seed', 'general', 23, true),
('Rainy season? Check Troski for flooding reports before heading out. Saves you from getting stuck.', 'Abena W.', 'seed', 'general', 12, true),
('Friday evenings from Accra to Cape Coast? Book intercity bus early or leave before 2 PM.', 'Papa Y.', 'seed', 'general', 10, true);
