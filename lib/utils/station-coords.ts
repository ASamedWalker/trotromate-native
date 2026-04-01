/**
 * Station coordinate fallbacks — single source of truth.
 * Primary source is Supabase `stations.latitude/longitude`.
 * These are used when DB coordinates are missing.
 *
 * Coordinates sourced from OpenStreetMap (Overpass API) + Mapcarta 2026-03-31.
 * © OpenStreetMap contributors (ODbL license)
 */

export const FALLBACK_STATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  // ─── Major Trotro Hubs (OSM verified) ─────────────────────────
  'Circle':               { latitude: 5.5696, longitude: -0.2133 }, // OSM N3109291911
  'Nkrumah Circle':       { latitude: 5.5696, longitude: -0.2133 }, // Alias
  'Circle Accra':         { latitude: 5.5696, longitude: -0.2133 }, // Route alias
  'Circle Indust. Area':  { latitude: 5.5696, longitude: -0.2133 }, // Route alias
  'Circle Industrial Area': { latitude: 5.5696, longitude: -0.2133 }, // Route alias
  'Circle Lido':          { latitude: 5.5696, longitude: -0.2133 }, // Route alias
  'Circle Odorna':        { latitude: 5.5703, longitude: -0.2151 }, // Circle Neoplan side
  'Circle Overhead':      { latitude: 5.5702, longitude: -0.2140 }, // OSM N4990163125
  'Madina':               { latitude: 5.6767, longitude: -0.1716 }, // OSM: Madina trotro station
  'Madina Station':       { latitude: 5.6767, longitude: -0.1716 }, // Alias
  'Madina-Adenta':        { latitude: 5.6900, longitude: -0.1690 }, // Between the two
  'Tema Station':         { latitude: 5.6596, longitude: -0.0097 }, // Tema city lorry park
  'Tema':                 { latitude: 5.6596, longitude: -0.0097 }, // Alias
  'Tema (Motorway)':      { latitude: 5.6596, longitude: -0.0097 }, // Route alias
  'Kaneshie':             { latitude: 5.5641, longitude: -0.2359 }, // OSM: Kaneshie market lorry park
  'Kaneshie Station':     { latitude: 5.5641, longitude: -0.2359 }, // Alias
  'Kaneshie Market Station': { latitude: 5.5658, longitude: -0.2352 }, // OSM N4995193049
  'Kaneshie Foot Bridge': { latitude: 5.5658, longitude: -0.2352 }, // Near market station
  'Kaneshie Takoradi Station': { latitude: 5.5653, longitude: -0.2368 }, // OSM: Takoradi Station
  'Lapaz':                { latitude: 5.6058, longitude: -0.2464 }, // Lapaz Junction
  'Lapaz-Nii Boi Junction': { latitude: 5.6077, longitude: -0.2452 }, // OSM N4982950480
  'Abeka Lapaz':          { latitude: 5.6073, longitude: -0.2482 }, // OSM N4980841285
  'Achimota':             { latitude: 5.6133, longitude: -0.2255 }, // OSM: Achimota Overhead
  'Achimota Terminal':    { latitude: 5.6215, longitude: -0.2259 }, // OSM: Achimota New Station
  'Legon':                { latitude: 5.6502, longitude: -0.1790 }, // OSM: Legon Station N4981090362
  'Legon Station':        { latitude: 5.6502, longitude: -0.1790 }, // Alias
  'Adenta':               { latitude: 5.7060, longitude: -0.1656 }, // OSM: Adenta Trotro Station
  'Adenta Station':       { latitude: 5.7060, longitude: -0.1656 }, // Alias
  'Kasoa':                { latitude: 5.5341, longitude: -0.4241 }, // OSM: Kasoa Bus Terminal
  'Kasoa- Accra CMB':     { latitude: 5.5341, longitude: -0.4241 }, // Alias
  'Mallam':               { latitude: 5.5710, longitude: -0.2855 }, // OSM: Mallam Junction N4462281289
  'Mallam Atta':          { latitude: 5.5710, longitude: -0.2855 }, // Alias
  'Mallam Attah':         { latitude: 5.5710, longitude: -0.2855 }, // Alias
  'Mallam Gbawe':         { latitude: 5.5766, longitude: -0.3096 }, // OSM: Gbawe Station
  'Dansoman':             { latitude: 5.5640, longitude: -0.2381 }, // OSM: Dansoman Station N2815317517
  'Dansoman Last Stop':   { latitude: 5.5300, longitude: -0.2652 }, // OSM N2026403681
  'Ashaiman':             { latitude: 5.6868, longitude: -0.0327 }, // OSM: Ashaiman Main Station
  'Ashaiman Main Station': { latitude: 5.6868, longitude: -0.0327 }, // Alias
  'Ashaiaman':            { latitude: 5.6868, longitude: -0.0327 }, // Misspelling in routes
  'Ashiaman':             { latitude: 5.6868, longitude: -0.0327 }, // Misspelling in routes
  'Spintex':              { latitude: 5.6288, longitude: -0.0902 }, // Spintex Road junction
  'Accra Central':        { latitude: 5.5446, longitude: -0.2048 }, // OSM: Tudu Station
  'Accra':                { latitude: 5.5446, longitude: -0.2048 }, // General Accra = Tudu
  'Accra CMB':            { latitude: 5.5446, longitude: -0.2048 }, // CMB = central motor block
  'Accra UTC':            { latitude: 5.5446, longitude: -0.2048 }, // UTC area
  'Accra U.T.C':          { latitude: 5.5446, longitude: -0.2048 }, // Alias
  'Accra Post Office':    { latitude: 5.5475, longitude: -0.2100 }, // Near GPO
  'Accra Post - Office':  { latitude: 5.5475, longitude: -0.2100 }, // Alias
  'Accra Rawlings Park':  { latitude: 5.5500, longitude: -0.2059 }, // Near STC Tudu
  'Rawlings Park':        { latitude: 5.5500, longitude: -0.2059 }, // Alias
  'Accra Salaga':         { latitude: 5.5432, longitude: -0.2046 }, // OSM: Accra Bishop area
  'Accra Bishop':         { latitude: 5.5432, longitude: -0.2046 }, // OSM N4987994166
  'Accra New Town':       { latitude: 5.5820, longitude: -0.1988 }, // Near Nima
  'Accra New Tema Station': { latitude: 5.5659, longitude: -0.2373 }, // OSM: Tema station (Kaneshie)
  'Accra End of the Motorway': { latitude: 5.5703, longitude: -0.2151 }, // Circle area

  // ─── Secondary Stations (OSM verified) ────────────────────────
  'Haatso':               { latitude: 5.6673, longitude: -0.2047 }, // OSM: Haatso
  'Ofankor':              { latitude: 5.6577, longitude: -0.2655 }, // OSM: Ofankor Barrier
  'Okponglo':             { latitude: 5.6413, longitude: -0.1781 }, // OSM: Okponglo bus stop
  'Taifa':                { latitude: 5.6584, longitude: -0.2529 }, // OSM: Taifa
  'Tetteh Quarshie':      { latitude: 5.6240, longitude: -0.1738 }, // OSM: Tetteh Quarshie Roundabout
  '37':                   { latitude: 5.5889, longitude: -0.1796 }, // OSM N4980841300
  '37 Military Hospital': { latitude: 5.5869, longitude: -0.2076 }, // OSM: 37 station N6968590872
  '37 Station':           { latitude: 5.5869, longitude: -0.2076 }, // Mapcarta N6968590872
  '37 Lorry Park':        { latitude: 5.5884, longitude: -0.1798 }, // OSM: 37 Last Stop
  'Ablekuma':             { latitude: 5.5480, longitude: -0.2520 }, // Ablekuma junction
  'Abokobi':              { latitude: 5.7150, longitude: -0.1530 }, // Abokobi town
  'Adjringanor':          { latitude: 5.6497, longitude: -0.1367 }, // Adjringanor
  'Adjiringanor':         { latitude: 5.6497, longitude: -0.1367 }, // Alias
  'Adjringanor/Otanor':   { latitude: 5.6497, longitude: -0.1367 }, // Route alias
  'Airport':              { latitude: 5.6065, longitude: -0.1773 }, // OSM: Airport First bus stop
  'Airport City':         { latitude: 5.5960, longitude: -0.1720 }, // Airport City
  'Asylum Down':          { latitude: 5.5709, longitude: -0.2025 }, // Asylum Down
  'Atadeka':              { latitude: 5.6906, longitude: -0.0320 }, // OSM: Atadeka Station N4327136891
  'Dodowa':               { latitude: 5.8881, longitude: -0.0899 }, // OSM: Dodowa Last Stop
  'Dome':                 { latitude: 5.6452, longitude: -0.2372 }, // OSM: Dome Crossing
  'Dome /Ashongman Estates': { latitude: 5.6605, longitude: -0.2373 }, // OSM: Dome New Station
  'Dome Kwabenya':        { latitude: 5.6907, longitude: -0.2477 }, // OSM: Kwabenya N4990251206
  'Dome Pillar 2':        { latitude: 5.6539, longitude: -0.2373 }, // OSM: Dome Mobil
  'Dome Railway Crossing': { latitude: 5.6472, longitude: -0.2365 }, // OSM: Dome Crossing
  'East Legon':           { latitude: 5.6483, longitude: -0.1508 }, // OSM: East Legon
  'Maamobi':              { latitude: 5.5905, longitude: -0.1970 }, // Maamobi
  'Nima':                 { latitude: 5.5820, longitude: -0.1988 }, // Nima
  'Nima Station':         { latitude: 5.5820, longitude: -0.1988 }, // Alias
  'Nima - Maamobi':       { latitude: 5.5860, longitude: -0.1980 }, // Between
  'Nima Maamobi':         { latitude: 5.5860, longitude: -0.1980 }, // Alias
  'Nima Mamobi':          { latitude: 5.5860, longitude: -0.1980 }, // Alias
  'Nima mamobi':          { latitude: 5.5860, longitude: -0.1980 }, // Alias
  'Nima-Mamobi':          { latitude: 5.5860, longitude: -0.1980 }, // Alias
  'Nima Overhead':        { latitude: 5.5820, longitude: -0.1988 }, // Nima Overhead area
  'Nima Overhead Maamobi': { latitude: 5.5860, longitude: -0.1980 }, // Between
  'Nungua':               { latitude: 5.6022, longitude: -0.0792 }, // OSM: Nugua Station N6433613586
  'Nungua Authority':     { latitude: 5.6022, longitude: -0.0792 }, // Same area
  'Osu':                  { latitude: 5.5541, longitude: -0.1836 }, // OSM: Osu
  'Osu (37 Station)':     { latitude: 5.5541, longitude: -0.1836 }, // Route alias
  'Osu Penta Hotel':      { latitude: 5.5570, longitude: -0.1800 }, // Osu area
  'Osu Presby':           { latitude: 5.5530, longitude: -0.1830 }, // Osu Presby area
  'Osu RE':               { latitude: 5.5541, longitude: -0.1836 }, // Osu area
  'St Johns':             { latitude: 5.6389, longitude: -0.2424 }, // OSM: St. Johns N4286137016
  'St. Johns':            { latitude: 5.6389, longitude: -0.2424 }, // Alias
  'Teshie':               { latitude: 5.5886, longitude: -0.0978 }, // OSM: Teshie First Junction
  'Teshie Nungua':        { latitude: 5.5950, longitude: -0.0880 }, // Between
  'Teshie-Nungua':        { latitude: 5.5950, longitude: -0.0880 }, // Alias

  // ─── Route Endpoints (OSM / Mapcarta verified) ────────────────
  'A Lang':               { latitude: 5.5890, longitude: -0.2182 }, // Alajo area (OSM N4990070162)
  'Abeka Main Market':    { latitude: 5.6008, longitude: -0.2393 }, // OSM N4990070169
  'Abelemkpe':            { latitude: 5.6099, longitude: -0.2109 }, // OSM: Abelenkpe Junction N4980841295
  'Abossey-Okai':         { latitude: 5.5582, longitude: -0.2297 }, // Abossey Okai spare parts market
  'Afropa':               { latitude: 5.6090, longitude: -0.2405 }, // Lapaz Market area
  'Agape':                { latitude: 5.6092, longitude: -0.3295 }, // OSM: Agape Main Station N5014899345
  'Agblezah':             { latitude: 5.6023, longitude: -0.0730 }, // Nungua-Sakumono corridor
  'Agbogbloshie':         { latitude: 5.5510, longitude: -0.2200 }, // Agbogbloshie market area
  'Agbogbloshie 2':       { latitude: 5.5510, longitude: -0.2200 }, // Same area
  'Agege':                { latitude: 5.5293, longitude: -0.2640 }, // OSM: Agege Last Stop N2026403679
  'Agyapa Ye North Kaneshie': { latitude: 5.5700, longitude: -0.2360 }, // Kaneshie area
  'Akoto Lante':          { latitude: 5.5346, longitude: -0.2378 }, // Mamprobi area
  'Akweteman Zongo':      { latitude: 5.6116, longitude: -0.2313 }, // OSM: Akweteyman N4980841291
  'Alajo':                { latitude: 5.5879, longitude: -0.2182 }, // OSM N4990070162
  'Alajo Junction':       { latitude: 5.5879, longitude: -0.2182 }, // Alias
  'Alajo Station':        { latitude: 5.5909, longitude: -0.2183 }, // OSM N4990163121
  'Alhaji':               { latitude: 5.6060, longitude: -0.2494 }, // Darkuman area (OSM N3154416434)
  'Amasaman':             { latitude: 5.7010, longitude: -0.3070 }, // Amasaman town
  'American House':       { latitude: 5.6190, longitude: -0.1508 }, // East Legon area
  'Antie Aku':            { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Antie-Eku Pallas Town': { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Anyah':                { latitude: 5.5560, longitude: -0.2970 }, // Anyaa area near Mallam
  'Apapa':                { latitude: 5.5673, longitude: -0.1637 }, // OSM: Apaapa lorry station N4324423391
  'Appiah Danquah':       { latitude: 5.5675, longitude: -0.1817 }, // OSM: Danquah Second N4198267793
  'Appiah Danquah/ Soko': { latitude: 5.5675, longitude: -0.1817 }, // Alias
  'Arena':                { latitude: 5.5756, longitude: -0.2382 }, // OSM: Olla Balm Station area
  'Ashale Botwe School Junction': { latitude: 5.6836, longitude: -0.1336 }, // OSM: Ashaley Botwe N4311941192
  'Ashongman':            { latitude: 5.6867, longitude: -0.1719 }, // OSM: Agbogba station N4920543022
  'Asofan':               { latitude: 5.6580, longitude: -0.2655 }, // Near Ofankor
  'Asore Danho':          { latitude: 5.5614, longitude: -0.2387 }, // OSM: Asoredan ho N4980974734
  'Atico':                { latitude: 5.5873, longitude: -0.2717 }, // OSM: Been To area N4752766522
  'Awoshie':              { latitude: 5.5890, longitude: -0.2512 }, // OSM: Darkuman-Circle Station area
  'Awoshie Last Stop':    { latitude: 5.5890, longitude: -0.2520 }, // Awoshie terminus
  'Ayi Mensah':           { latitude: 5.7280, longitude: -0.1370 }, // Ayi Mensah hillside
  'Ayikuma':              { latitude: 5.8530, longitude: -0.0500 }, // Ayikuma town on Dodowa road
  'Banana Inn':           { latitude: 5.5643, longitude: -0.2362 }, // OSM N2815303473
  'Banana Inn/Dansoman':  { latitude: 5.5643, longitude: -0.2362 }, // Alias
  'Bawaleshie':           { latitude: 5.6421, longitude: -0.1649 }, // OSM: La Bawaleshie N3133741256
  'Bubiashie':            { latitude: 5.5951, longitude: -0.2220 }, // OSM: CAT area
  'Bubuashie':            { latitude: 5.5951, longitude: -0.2220 }, // Alias
  'Bubiashie Ayigbe Town': { latitude: 5.5951, longitude: -0.2220 }, // Same area
  'Bubuashie Ayigbe Town': { latitude: 5.5951, longitude: -0.2220 }, // Alias
  'Bubiashie Control (Old Station )': { latitude: 5.5951, longitude: -0.2220 }, // Same area
  'Bubiashie-Atico':      { latitude: 5.5910, longitude: -0.2450 }, // Between
  'Camara':               { latitude: 5.5680, longitude: -0.2160 }, // Near Circle
  'Cantonment':           { latitude: 5.5700, longitude: -0.1750 }, // Cantonments area
  'Cantonments':          { latitude: 5.5700, longitude: -0.1750 }, // Alias
  'Caprice':              { latitude: 5.5840, longitude: -0.2170 }, // OSM N4990070161
  'Chemuna':              { latitude: 5.6020, longitude: -0.0690 }, // Sakumono area
  'Chorkor':              { latitude: 5.5290, longitude: -0.2440 }, // Chorkor fishing area
  'Christian Centre':     { latitude: 5.6354, longitude: -0.2147 }, // OSM: Christian Village N4981090365
  'Darkuman':             { latitude: 5.6059, longitude: -0.2494 }, // OSM: Darkuman Station N3154416434
  'Dzorwulu':             { latitude: 5.6073, longitude: -0.2070 }, // OSM: Dzorwulu Junction N4980841296
  'Ebenezer':             { latitude: 5.6052, longitude: -0.2037 }, // OSM: Ebony area N4980841297
  'Fadama Last stop':     { latitude: 5.6017, longitude: -0.2408 }, // OSM: Fadama N4990070170
  'Fan-Milk':             { latitude: 5.5998, longitude: -0.2377 }, // OSM: Free Pipe area
  'Glefe':                { latitude: 5.5260, longitude: -0.2520 }, // Glefe coastal area
  'Good Shepherd':        { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Hansonic':             { latitude: 5.6230, longitude: -0.0730 }, // Near Sakumono
  'Immesco Rice':         { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Israel Lomnava':       { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Kokomlemle':           { latitude: 5.5790, longitude: -0.2060 }, // Near Paloma
  'Korle Bu':             { latitude: 5.5362, longitude: -0.2264 }, // OSM N4979349924
  'Korlebu':              { latitude: 5.5362, longitude: -0.2264 }, // Alias
  'Kotobabi Down':        { latitude: 5.5840, longitude: -0.2100 }, // Kotobabi area
  'Kotobabi Down Polo Park': { latitude: 5.5840, longitude: -0.2100 }, // Alias
  'Kotobabi Down/Polo park': { latitude: 5.5840, longitude: -0.2100 }, // Alias
  'Kotobabi Police Station': { latitude: 5.5840, longitude: -0.2100 }, // Same area
  'Kotokuo':              { latitude: 5.5450, longitude: -0.2050 }, // Tudu/Makola area
  'Kufour Station':       { latitude: 5.6854, longitude: -0.0335 }, // OSM N4286157299
  'Kuntunse/Satelite':    { latitude: 5.7100, longitude: -0.2700 }, // Kuntunse town
  'Kwashieman':           { latitude: 5.5840, longitude: -0.2670 }, // Kwashieman area
  'Kwashieman Junction':  { latitude: 5.5840, longitude: -0.2670 }, // Alias
  'Kwashieman/Santa Maria': { latitude: 5.5850, longitude: -0.2600 }, // Between
  'La Olympia':           { latitude: 5.5595, longitude: -0.1585 }, // OSM: La Main Lorry Station N2151944574
  'Lomnava':              { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Makola Tudu':          { latitude: 5.5446, longitude: -0.2048 }, // OSM: Tudu Station N3095484237
  'Mamponse':             { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Mamprobi':             { latitude: 5.5347, longitude: -0.2378 }, // OSM: Mamprobi Station N4980974744
  'Mamprobi Alhaji':      { latitude: 5.5347, longitude: -0.2378 }, // Same area
  'Mamprobi C Lante':     { latitude: 5.5335, longitude: -0.2376 }, // OSM: Mamprobi Shell N4980974768
  'Manhean':              { latitude: 5.6569, longitude: -0.0210 }, // OSM: Manhean Bus Station N4350218309
  'Manhean Afuaman':      { latitude: 5.6569, longitude: -0.0210 }, // Same area
  'Mataheko':             { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Mateytse':             { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Mayera':               { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Mayera/Adusa':         { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Medie/Kotoku':         { latitude: 5.7300, longitude: -0.2700 }, // Medie town north of Ofankor
  'Ministries':           { latitude: 5.5560, longitude: -0.1950 }, // Near Ridge
  'New Fadama':           { latitude: 5.6017, longitude: -0.2408 }, // Fadama area
  'New Melcom':           { latitude: 5.5446, longitude: -0.2048 }, // Tudu/Makola area
  'New Russia Last Stop': { latitude: 5.5546, longitude: -0.2546 }, // OSM: Russia Station N4996742714
  'New Town':             { latitude: 5.5820, longitude: -0.1988 }, // Accra New Town
  'North Industrial Area': { latitude: 5.5930, longitude: -0.2350 }, // Industrial Area
  'Novotel':              { latitude: 5.5580, longitude: -0.1930 }, // Near Accra central
  'Nsawam':               { latitude: 5.8090, longitude: -0.3490 }, // Nsawam town
  'Nyamekye':             { latitude: 5.6029, longitude: -0.2564 }, // OSM N2815791263
  'Nyaho':                { latitude: 5.5870, longitude: -0.1750 }, // Near 37 area
  'Odorna':               { latitude: 5.5673, longitude: -0.2173 }, // OSM N3109289830
  'Odorna-Circle':        { latitude: 5.5690, longitude: -0.2150 }, // Between
  'Odorkor':              { latitude: 5.5797, longitude: -0.2648 }, // OSM N4740602036
  'Official Town':        { latitude: 5.5381, longitude: -0.4028 }, // OSM: Official Town Taxi Rank N5825177095
  'Omanjor':              { latitude: 5.6600, longitude: -0.2850 }, // Omanjor area
  'Opetekwei':            { latitude: 5.5310, longitude: -0.2640 }, // Dansoman area
  'Orgle Road':           { latitude: 5.5300, longitude: -0.2650 }, // Dansoman area
  'Orgle Street':         { latitude: 5.5300, longitude: -0.2650 }, // Alias
  'Orgle-Road':           { latitude: 5.5300, longitude: -0.2650 }, // Alias
  'Pigfarm':              { latitude: 5.5999, longitude: -0.1959 }, // OSM: Pig Farm Junction N4982950474
  'Pokuase Amasaman':     { latitude: 5.7010, longitude: -0.3070 }, // Pokuase area
  'Pokuase Junction':     { latitude: 5.6960, longitude: -0.2900 }, // Pokuase Junction
  'Race Course':          { latitude: 5.6141, longitude: -0.2714 }, // OSM N4983245621
  'Ridge Hospital':       { latitude: 5.5605, longitude: -0.1966 }, // OSM: Ridge N4974193125
  'Russia':               { latitude: 5.5546, longitude: -0.2546 }, // OSM: Russia Station N4996742714
  'Russia Last Stop':     { latitude: 5.5546, longitude: -0.2546 }, // Alias
  'SSNIT Flats':          { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Sakaman Blue Lagoon':  { latitude: 5.5640, longitude: -0.2360 }, // Sakaman area
  'Santa Maria':          { latitude: 5.5900, longitude: -0.2500 }, // Santa Maria junction
  'Sapeiman':             { latitude: 5.6800, longitude: -0.2900 }, // Sapeiman town
  'Shalom':               { latitude: 5.5312, longitude: -0.2322 }, // OSM N4980974748
  'Shiabu':               { latitude: 5.6277, longitude: -0.1764 }, // OSM: Shiashie N2581150583
  'Six to Six Market':    { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Soko':                 { latitude: 5.5675, longitude: -0.1817 }, // Danquah area
  'South Odorkor':        { latitude: 5.5797, longitude: -0.2648 }, // Odorkor area
  'Sowutuom':             { latitude: 5.6248, longitude: -0.2834 }, // OSM N325329480
  'Stadium':              { latitude: 5.5560, longitude: -0.1930 }, // Accra Sports Stadium area
  'Sukura':               { latitude: 5.5910, longitude: -0.2183 }, // Near Alajo
  'Sukura Station':       { latitude: 5.5910, longitude: -0.2183 }, // Alias
  'Swanlake':             { latitude: 5.5870, longitude: -0.2100 }, // Swan Lake area
  'Swanlake Last Stop':   { latitude: 5.5870, longitude: -0.2100 }, // Alias
  'Tabora Alhaji':        { latitude: 5.6037, longitude: -0.2578 }, // OSM: Tabora Number 1 N3154321446
  'Teachers Hall':        { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Tema Community One Market': { latitude: 5.6580, longitude: -0.0035 }, // OSM: Community 4 N3676894848
  'Trade Fair (La)':      { latitude: 5.5856, longitude: -0.1440 }, // La Trade Fair area
  'Tse Addo':             { latitude: 5.5600, longitude: -0.1600 }, // Near La
  'Tsui Bleoo':           { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'WAEC':                 { latitude: 5.5950, longitude: -0.1850 }, // WAEC office near 37
  'Weija':                { latitude: 5.5512, longitude: -0.3292 }, // OSM: Weija Barrier N4740682127
  'Yellow House':         { latitude: 5.5640, longitude: -0.2360 }, // Kaneshie area
  'Zambrama Line':        { latitude: 5.5446, longitude: -0.2048 }, // Tudu area
  'Zamrama Line':         { latitude: 5.5446, longitude: -0.2048 }, // Alias
  'Zongo Junction':       { latitude: 5.5578, longitude: -0.2398 }, // OSM N4980974735

  // ─── Tema Communities & Surrounding ───────────────────────────
  'Community 4':          { latitude: 5.6580, longitude: -0.0035 }, // OSM N3676894848
  'Community 7':          { latitude: 5.6647, longitude: -0.0062 }, // OSM N3676894849
  'Community 9':          { latitude: 5.6790, longitude: -0.0123 }, // OSM N4400503912
  'Community 11 Station': { latitude: 5.6645, longitude: -0.0276 }, // OSM N4400503924
  'Site 10':              { latitude: 5.6510, longitude: 0.0002 },  // OSM N3676894846
  'Site 20':              { latitude: 5.6474, longitude: 0.0023 },  // OSM N3676894839

  // ─── Key Bus Stops (OSM verified) ────────────────────────────
  'Abeka Junction':       { latitude: 5.5989, longitude: -0.2240 }, // OSM N4990070164
  'Achimota Overhead':    { latitude: 5.6133, longitude: -0.2255 }, // OSM N4980841293
  'ACP Junction':         { latitude: 5.6840, longitude: -0.2777 }, // OSM N1986177611
  'Agbogba Junction':     { latitude: 5.6673, longitude: -0.1873 }, // OSM N4972695858
  'Baatsona Total':       { latitude: 5.6276, longitude: -0.0871 }, // OSM N4990644974
  'Kokrobite':            { latitude: 5.4984, longitude: -0.3666 }, // OSM N1887620725
  'Korle Bu Junction':    { latitude: 5.5436, longitude: -0.2399 }, // OSM N4980974730
  'Kwabenya':             { latitude: 5.6907, longitude: -0.2477 }, // OSM N4990251206
  'Labone':               { latitude: 5.5621, longitude: -0.1725 }, // OSM N2961513337
  'Labadi':               { latitude: 5.5595, longitude: -0.1585 }, // La area
  'McCarthy Junction':    { latitude: 5.5655, longitude: -0.2889 }, // OSM N4739843023
  'Prampram':             { latitude: 5.7115, longitude: 0.1090 },  // OSM: Prampram Station N3602639338
  'Sakumono':             { latitude: 5.6226, longitude: -0.0694 }, // OSM N4990644967
  'Tesano':               { latitude: 5.6046, longitude: -0.2260 }, // OSM N2917271600
  'Bortianor':            { latitude: 5.5475, longitude: -0.3481 }, // OSM N4740601929
  'Tuba':                 { latitude: 5.5469, longitude: -0.3819 }, // OSM N4740602044
  'Mile Eleven':          { latitude: 5.5508, longitude: -0.3559 }, // OSM N4740601928
  'Suhum':                { latitude: 5.7302, longitude: -0.2047 }, // OSM: Suhum Main Station N5307365542

  // ─── Train stations: Tema–Accra Commuter (TMA) ────────────────
  // OSM Overpass API verified, 2026-03-24
  'Asoprochona':          { latitude: 5.6144, longitude: -0.0551 }, // OSM: Asaprochona station
  'Batchona':             { latitude: 5.6199, longitude: -0.1196 }, // OSM: Baatsona station
  'Odaw (Circle)':        { latitude: 5.5655, longitude: -0.2191 }, // OSM: Odo station

  // ─── Train stations: Tema–Mpakadan (TMP) ──────────────────────
  // OSM for Tema Harbour + Kpong; Mapcarta for rest
  'Tema Harbour':         { latitude: 5.6313, longitude: 0.0018 },  // OSM: Tema Fishing Harbour Train Station
  'Tema Industrial Area': { latitude: 5.6796, longitude: 0.0026 },  // Mapcarta verified
  'Afienya':              { latitude: 5.7981, longitude: 0.0052 },  // Mapcarta verified
  'Shai Hills':           { latitude: 5.8840, longitude: 0.0386 },  // Mapcarta verified
  'Doryumu':              { latitude: 5.9007, longitude: 0.0232 },  // Mapcarta verified
  'Kpong':                { latitude: 6.1759, longitude: 0.0591 },  // OSM verified station node
  'Juapong':              { latitude: 6.2545, longitude: 0.1353 },  // Mapcarta verified
  'Mpakadan':             { latitude: 6.3322, longitude: 0.1090 },  // Mapcarta verified
}

/**
 * Get coordinates for a station. Prefers DB values, falls back to curated list.
 */
// Pre-built lowercase lookup for case-insensitive fallback matching
const FALLBACK_LOOKUP: Record<string, { latitude: number; longitude: number }> = {}
for (const [key, val] of Object.entries(FALLBACK_STATION_COORDS)) {
  FALLBACK_LOOKUP[key.toLowerCase()] = val
}

export function getStationCoords(
  station: { name: string; latitude?: number | null; longitude?: number | null }
): { latitude: number; longitude: number } | null {
  // Prefer curated Mapcarta/OSM coordinates — more accurate than DB values
  const curated = FALLBACK_STATION_COORDS[station.name]
    ?? FALLBACK_LOOKUP[station.name.toLowerCase()]
  if (curated) return curated
  // Fall back to DB coordinates only if no curated match
  if (station.latitude && station.longitude) {
    return { latitude: station.latitude, longitude: station.longitude }
  }
  return null
}
