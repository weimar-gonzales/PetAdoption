USE pet_adoption;

INSERT INTO pets (name, species, breed, age, gender, size, description, image_url, status)
SELECT 'Luna', 'dog', 'Labrador mix', 3, 'female', 'large', 'A friendly, energetic dog who loves walks and people.', NULL, 'available'
WHERE NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Luna');

INSERT INTO pets (name, species, breed, age, gender, size, description, image_url, status)
SELECT 'Milo', 'cat', 'Domestic shorthair', 2, 'male', 'small', 'A curious, gentle cat who enjoys sunny windows and quiet homes.', NULL, 'available'
WHERE NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Milo');

INSERT INTO pets (name, species, breed, age, gender, size, description, image_url, status)
SELECT 'Clover', 'rabbit', 'Lionhead', 1, 'female', 'small', 'A calm rabbit looking for a patient indoor home.', NULL, 'available'
WHERE NOT EXISTS (SELECT 1 FROM pets WHERE name = 'Clover');
