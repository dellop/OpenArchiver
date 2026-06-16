import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--test', 'dist/**/*.test.js'], {
	stdio: 'inherit',
	env: {
		...process.env,
		NODE_ENV: 'test',
		STORAGE_TYPE: process.env.STORAGE_TYPE || 'local',
		STORAGE_LOCAL_ROOT_PATH: process.env.STORAGE_LOCAL_ROOT_PATH || '.test-storage',
		DATABASE_URL: process.env.DATABASE_URL || 'postgres://test:test@127.0.0.1:5432/test',
		ENCRYPTION_KEY:
			process.env.ENCRYPTION_KEY ||
			'0000000000000000000000000000000000000000000000000000000000000000',
	},
});

process.exit(result.status ?? 1);
