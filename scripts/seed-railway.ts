/**
 * Seed script for Railway PostgreSQL database via API
 * Seeds demo data for RTW Monson Swimming Club
 */

const API_BASE = 'https://membership-api-production-3628.up.railway.app/api';

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface Squad {
  id: string;
  name: string;
  ageMin: number;
  ageMax: number;
}

interface Swimmer {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  squadId?: string;
}

interface Family {
  id: string;
  name: string;
}

interface Session {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  squadId: string;
}

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  squadId?: string;
}

let authToken: string | null = null;

async function apiCall(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`${method} ${url}`);
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`Error: ${response.status} ${response.statusText}`);
    console.error(`Response: ${text}`);
    throw new Error(`API call failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data;
}

async function registerAndLogin(): Promise<void> {
  console.log('\n=== Registering Admin User ===');
  
  const adminData = {
    email: 'admin@swimly.uk',
    password: 'SwimlyDemo2026!',
    name: 'Admin User',
    role: 'admin',
  };

  try {
    // Try /api/auth/register first
    try {
      const response = await apiCall('/auth/register', 'POST', adminData);
      console.log('✓ Admin user registered via /auth/register');
      
      if (response.access_token) {
        authToken = response.access_token;
        console.log('✓ Auth token received from registration');
        return;
      }
    } catch (registerError) {
      console.log('Registration endpoint /auth/register not available, trying alternatives...');
    }

    // Try /api/register
    try {
      const response = await apiCall('/register', 'POST', adminData);
      console.log('✓ Admin user registered via /register');
      
      if (response.access_token) {
        authToken = response.access_token;
        console.log('✓ Auth token received from registration');
        return;
      }
    } catch (registerError) {
      console.log('Registration endpoint /register not available');
    }

    // Try to log in instead
    console.log('Attempting to log in with existing credentials...');
    const loginResponse = await apiCall('/auth/login', 'POST', {
      email: adminData.email,
      password: adminData.password,
    });
    
    authToken = loginResponse.access_token;
    console.log('✓ Logged in successfully');
  } catch (error) {
    console.error('Failed to register or login:', error);
    throw error;
  }
}

async function createSquads(): Promise<Squad[]> {
  console.log('\n=== Creating Squads ===');
  
  const squadData = [
    { name: 'Development', ageMin: 6, ageMax: 8, description: 'Beginners and foundation swimmers' },
    { name: 'Junior', ageMin: 9, ageMax: 11, description: 'Developing competitive swimmers' },
    { name: 'Senior', ageMin: 12, ageMax: 16, description: 'Advanced competitive swimmers' },
    { name: 'Masters', ageMin: 17, ageMax: 99, description: 'Adult competitive swimmers' },
  ];

  const squads: Squad[] = [];

  for (const data of squadData) {
    try {
      const squad = await apiCall('/squads', 'POST', data);
      console.log(`✓ Created squad: ${data.name} (ages ${data.ageMin}-${data.ageMax})`);
      squads.push(squad);
    } catch (error) {
      console.error(`Failed to create squad ${data.name}:`, error);
    }
  }

  return squads;
}

async function createSwimmers(squads: Squad[]): Promise<Swimmer[]> {
  console.log('\n=== Creating Swimmers ===');
  
  const britishNames = [
    { firstName: 'Oliver', lastName: 'Smith', age: 7 },
    { firstName: 'Amelia', lastName: 'Johnson', age: 8 },
    { firstName: 'Harry', lastName: 'Williams', age: 6 },
    { firstName: 'Isla', lastName: 'Brown', age: 7 },
    { firstName: 'George', lastName: 'Jones', age: 10 },
    { firstName: 'Poppy', lastName: 'Davis', age: 11 },
    { firstName: 'Noah', lastName: 'Miller', age: 9 },
    { firstName: 'Freya', lastName: 'Wilson', age: 10 },
    { firstName: 'Charlie', lastName: 'Taylor', age: 13 },
    { firstName: 'Sophie', lastName: 'Anderson', age: 14 },
    { firstName: 'Oscar', lastName: 'Thomas', age: 12 },
    { firstName: 'Emily', lastName: 'Roberts', age: 15 },
    { firstName: 'Jack', lastName: 'Evans', age: 16 },
    { firstName: 'Grace', lastName: 'Harris', age: 13 },
    { firstName: 'Thomas', lastName: 'Robinson', age: 18 },
    { firstName: 'Lily', lastName: 'Clarke', age: 22 },
    { firstName: 'James', lastName: 'Walker', age: 25 },
    { firstName: 'Evie', lastName: 'Hall', age: 19 },
    { firstName: 'William', lastName: 'Wright', age: 28 },
    { firstName: 'Ella', lastName: 'King', age: 21 },
  ];

  const swimmers: Swimmer[] = [];
  const today = new Date();

  for (const data of britishNames) {
    const birthYear = today.getFullYear() - data.age;
    const dateOfBirth = `${birthYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Assign to appropriate squad based on age
    let squad: Squad | undefined;
    if (data.age >= 6 && data.age <= 8) {
      squad = squads.find(s => s.name === 'Development');
    } else if (data.age >= 9 && data.age <= 11) {
      squad = squads.find(s => s.name === 'Junior');
    } else if (data.age >= 12 && data.age <= 16) {
      squad = squads.find(s => s.name === 'Senior');
    } else if (data.age >= 17) {
      squad = squads.find(s => s.name === 'Masters');
    }

    const swimmerData = {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth,
      squadId: squad?.id,
    };

    try {
      const swimmer = await apiCall('/swimmers', 'POST', swimmerData);
      console.log(`✓ Created swimmer: ${data.firstName} ${data.lastName} (${data.age} years old, ${squad?.name || 'no squad'})`);
      swimmers.push(swimmer);
    } catch (error) {
      console.error(`Failed to create swimmer ${data.firstName} ${data.lastName}:`, error);
    }
  }

  return swimmers;
}

async function createFamilies(swimmers: Swimmer[]): Promise<Family[]> {
  console.log('\n=== Creating Families ===');
  
  const families: Family[] = [];
  
  // Create 10 families with unique names
  const familyNames = [
    'Smith Family',
    'Johnson Family',
    'Williams Family',
    'Brown Family',
    'Jones Family',
    'Davis Family',
    'Miller Family',
    'Wilson Family',
    'Taylor Family',
    'Anderson Family',
  ];

  for (const familyName of familyNames) {
    try {
      const family = await apiCall('/families', 'POST', {
        name: familyName,
      });
      console.log(`✓ Created family: ${familyName}`);
      families.push(family);
    } catch (error) {
      console.error(`Failed to create family ${familyName}:`, error);
    }
  }

  // Link swimmers to families (2 swimmers per family where possible)
  for (let i = 0; i < families.length && i * 2 < swimmers.length; i++) {
    const family = families[i];
    const swimmerIndices = [i * 2, i * 2 + 1].filter(idx => idx < swimmers.length);
    
    for (const idx of swimmerIndices) {
      const swimmer = swimmers[idx];
      try {
        await apiCall(`/families/${family.id}/swimmers/${swimmer.id}`, 'POST');
        console.log(`✓ Linked swimmer ${swimmer.firstName} ${swimmer.lastName} to ${family.name}`);
      } catch (error) {
        console.error(`Failed to link swimmer to family:`, error);
      }
    }
  }

  return families;
}

async function createSessions(squads: Squad[]): Promise<Session[]> {
  console.log('\n=== Creating Training Sessions ===');
  
  const sessions: Session[] = [];
  
  // Mon/Wed/Fri evenings 18:00-19:00
  const eveningDays = [1, 3, 5]; // Monday, Wednesday, Friday
  
  // Saturday morning 09:00-10:00
  const saturdayMorning = 6;
  
  for (const squad of squads) {
    // Create evening sessions
    for (const dayOfWeek of eveningDays) {
      const sessionData = {
        dayOfWeek,
        startTime: '18:00',
        endTime: '19:00',
        squadId: squad.id,
      };
      
      try {
        const session = await apiCall('/sessions', 'POST', sessionData);
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
        console.log(`✓ Created session: ${squad.name} - ${dayName} 18:00-19:00`);
        sessions.push(session);
      } catch (error) {
        console.error(`Failed to create session:`, error);
      }
    }
    
    // Create Saturday morning session
    const saturdaySessionData = {
      dayOfWeek: saturdayMorning,
      startTime: '09:00',
      endTime: '10:00',
      squadId: squad.id,
    };
    
    try {
      const session = await apiCall('/sessions', 'POST', saturdaySessionData);
      console.log(`✓ Created session: ${squad.name} - Sat 09:00-10:00`);
      sessions.push(session);
    } catch (error) {
      console.error(`Failed to create session:`, error);
    }
  }

  return sessions;
}

async function createFeeStructures(squads: Squad[]): Promise<FeeStructure[]> {
  console.log('\n=== Creating Fee Structures ===');
  
  const fees: FeeStructure[] = [];
  
  const feeData = [
    { name: 'Development Monthly Fee', amount: 3500, frequency: 'monthly', squadName: 'Development' },
    { name: 'Junior Monthly Fee', amount: 4500, frequency: 'monthly', squadName: 'Junior' },
    { name: 'Senior Monthly Fee', amount: 5500, frequency: 'monthly', squadName: 'Senior' },
  ];

  for (const data of feeData) {
    const squad = squads.find(s => s.name === data.squadName);
    
    const feeStructureData = {
      name: data.name,
      amount: data.amount, // Amount in pence
      frequency: data.frequency,
      squadId: squad?.id,
    };

    try {
      const fee = await apiCall('/fees', 'POST', feeStructureData);
      console.log(`✓ Created fee structure: ${data.name} - £${(data.amount / 100).toFixed(2)}/month`);
      fees.push(fee);
    } catch (error) {
      console.error(`Failed to create fee structure ${data.name}:`, error);
    }
  }

  return fees;
}

async function main(): Promise<void> {
  console.log('========================================');
  console.log('Swimly Railway Database Seed Script');
  console.log('RTW Monson Swimming Club Demo Data');
  console.log('========================================\n');
  console.log(`API Base: ${API_BASE}\n`);

  try {
    await registerAndLogin();
    
    const squads = await createSquads();
    const swimmers = await createSwimmers(squads);
    const families = await createFamilies(swimmers);
    const sessions = await createSessions(squads);
    const feeStructures = await createFeeStructures(squads);

    console.log('\n========================================');
    console.log('✓ Seed Complete!');
    console.log('========================================');
    console.log(`Squads created: ${squads.length}`);
    console.log(`Swimmers created: ${swimmers.length}`);
    console.log(`Families created: ${families.length}`);
    console.log(`Sessions created: ${sessions.length}`);
    console.log(`Fee structures created: ${feeStructures.length}`);
    console.log('\nDemo credentials:');
    console.log('Email: admin@swimly.uk');
    console.log('Password: SwimlyDemo2026!');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

// Export as default
export default main;

// Allow running directly
if (require.main === module) {
  main();
}
