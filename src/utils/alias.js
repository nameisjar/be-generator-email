// Alias local-part helpers. Keep the rules consistent on both backend and Worker.

const ALIAS_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

// Common Indonesian first names for human-readable random aliases.
// Concatenated with a 3-digit suffix by randomAliasLocalPart().
const NAMES = [
  'adi', 'agus', 'aji', 'akbar', 'ali', 'alif', 'alwi', 'amir', 'amran', 'andi',
  'angga', 'anindya', 'anto', 'anton', 'anwar', 'aqil', 'ari', 'arid', 'arif', 'ario',
  'aris', 'ariyanto', 'arkan', 'arsa', 'aryo', 'asep', 'asgar', 'aslan', 'aswad', 'atmo',
  'aulia', 'awang', 'ayman', 'ayu', 'aza', 'azhar', 'aziz', 'azmi', 'bagus', 'bahar',
  'bambang', 'bani', 'bayu', 'bella', 'bima', 'bondan', 'budi', 'butet', 'caesar', 'cahya',
  'cakra', 'candra', 'cantik', 'cecep', 'chandra', 'chika', 'citra', 'claudia', 'daffa', 'dalang',
  'danang', 'danu', 'dara', 'darmawan', 'darwis', 'datu', 'dea', 'delia', 'dewa', 'dewi',
  'dharma', 'dhia', 'dian', 'dila', 'dimas', 'dinda', 'doni', 'dwiki', 'dwi', 'eka',
  'eki', 'edi', 'edo', 'eli', 'elis', 'elok', 'eman', 'endah', 'endang', 'erlangga',
  'erwin', 'etty', 'eva', 'evi', 'euis', 'fadhlur', 'fadhil', 'fadhli', 'fadli', 'fahmi',
  'fairuz', 'faisal', 'fajar', 'fakhri', 'fanani', 'farah', 'farhan', 'farid', 'fathan', 'fatih',
  'fatimah', 'fatma', 'febri', 'ferdi', 'fian', 'fikri', 'fina', 'firman', 'fitra', 'fitri',
  'franky', 'fuad', 'gabriel', 'galang', 'galih', 'gita', 'guntur', 'habib', 'hadi', 'hafiz',
  'haidar', 'hakim', 'halim', 'hana', 'hanif', 'hanna', 'hans', 'hari', 'haris', 'harun',
  'hasan', 'helmi', 'hendro', 'heri', 'herlina', 'hilmi', 'hisyam', 'humaidi', 'husain', 'husni',
  'ibnu', 'icha', 'ichsan', 'ikbal', 'ilham', 'imam', 'imani', 'imel', 'imran', 'ina',
  'indah', 'indira', 'indra', 'indri', 'intan', 'irfan', 'irham', 'irma', 'isa', 'iskandar',
  'ismail', 'iwan', 'iza', 'izza', 'jaka', 'jamil', 'jasmin', 'javier', 'jaya', 'jeffry',
  'jelita', 'jenar', 'jihan', 'joko', 'juan', 'juli', 'juned', 'juni', 'kamil', 'karim',
  'karla', 'karmila', 'kasih', 'kautsar', 'kenzie', 'kezia', 'khadafi', 'khairul', 'khansa', 'kharis',
  'khofifah', 'kiki', 'kinasih', 'kinanti', 'kirana', 'koko', 'kristin', 'kukuh', 'kuntum', 'kurnia',
  'kurniawan', 'laila', 'latif', 'latifah', 'laura', 'leni', 'lia', 'lintang', 'lisa', 'lucky',
  'luki', 'lukman', 'lulu', 'lusi', 'lutfi', 'lydia', 'made', 'mahesa', 'mahira', 'mahmud',
  'maisa', 'mala', 'malika', 'maria', 'marina', 'marisa', 'maryam', 'maulana', 'maulida', 'mega',
  'meidi', 'melati', 'melia', 'melinda', 'merta', 'mia', 'miftah', 'mila', 'mira', 'miranti',
  'mizan', 'mochammad', 'muhammad', 'mukti', 'mulyadi', 'mumtaz', 'munir', 'mutia', 'nada', 'nadia',
  'nadin', 'najla', 'najwa', 'nanda', 'nani', 'nasrul', 'naufal', 'nela', 'nia', 'nidya',
  'nila', 'ningsih', 'nisa', 'nissa', 'nita', 'novia', 'noval', 'nugraha', 'nugroho', 'nunik',
  'nur', 'nurbaya', 'nurhaliza', 'nurhayati', 'nuri', 'nurul', 'nusrat', 'octa', 'oki', 'okta',
  'oktavia', 'oman', 'omar', 'opi', 'oscar', 'padma', 'panji', 'pandu', 'pangestu', 'paris',
];

function isValidAliasLocalPart(value) {
  return typeof value === 'string' && ALIAS_REGEX.test(value);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function randomAliasLocalPart(prefix = '') {
  // Human-readable: Indonesian first name + 3-digit suffix, no separator.
  // Examples: handoko042, dewi173, setiawan809.
  // With ~300 names × 900 numbers = 270000 combinations; collisions are
  // retried by the caller (aliasService retries up to 5 times).
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100-999
  const generated = `${name}${num}`;
  return prefix ? `${prefix}-${generated}` : generated;
}

module.exports = { isValidAliasLocalPart, normalize, randomAliasLocalPart, ALIAS_REGEX };
// 