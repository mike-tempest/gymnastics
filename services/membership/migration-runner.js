const { DataSource } = require('typeorm');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'swim_nexus_dev',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  logging: true,
});

AppDataSource.initialize()
  .then(async () => {
    console.log('Data Source has been initialized!');
    await AppDataSource.runMigrations();
    console.log('Migrations completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error during Data Source initialization:', err);
    process.exit(1);
  });
