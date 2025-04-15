const core = require('@actions/core');
const MSTeams = require('./MSTeams');

const missing_functionality_warning = objective =>
	core.warning(`Missing ${objective} parameter will result in reduced functionality.`) || {};

const access_context = context_name => {
	let context = core.getInput(context_name);
	if (!context) {
		missing_functionality_warning(context_name);
		return {};
	}
	
	if (context === '') return {};
	
	try {
		// Debug logging
		core.info(`Attempting to parse ${context_name} context`);
		core.info(`Raw input: ${context.substring(0, 100)}...`); // Log first 100 chars
		
		// Try to parse the JSON
		const parsed = JSON.parse(context);
		
		// Debug logging of parsed structure
		core.info(`Successfully parsed ${context_name} context`);
		core.info(`Structure: ${JSON.stringify(Object.keys(parsed))}`);
		
		return parsed;
	} catch (error) {
		core.error(`Failed to parse ${context_name} context: ${error.message}`);
		core.error(`Error occurred at position ${error.position}`);
		core.error(`Context length: ${context.length}`);
		
		// Try to find circular references
		if (error.message.includes('circular')) {
			core.error('Circular reference detected!');
			// Return a simplified version
			return {
				error: 'Circular reference detected',
				context_name: context_name,
				length: context.length
			};
		}
		
		return {};
	}
};

async function run() {
	try {
		const webhook_url = process.env.MSTEAMS_WEBHOOK || core.getInput('webhook_url');
		if (webhook_url === '') {
			throw new Error(
				'[Error] Missing Microsoft Teams Incoming Webhooks URL.\n' +
				'Please configure "MSTEAMS_WEBHOOK" as environment variable or\n' +
				'specify the key called "webhook_url" in "with" section.'
			);
		}

		let job = access_context('job');
		let steps = access_context('steps');
		let needs = access_context('needs');

		let title = core.getInput('title');
		let msteams_emails= core.getInput('msteams_emails');
		let raw = core.getInput('raw');
		let dry_run = core.getInput('dry_run');

		core.info(`Parsed params:\n${JSON.stringify({
			webhook_url: '***',
			job,
			steps,
			needs,
			raw,
			title,
			msteams_emails,
			dry_run
		})}`);

		const msteams = new MSTeams();
		let payload;
		if (raw === '') {
			payload = await msteams.generatePayload(
				{
					job,
					steps,
					needs,
					title,
					msteams_emails
				}
			);
		} else {
			payload = Object.assign({}, msteams.header, JSON.parse(raw));
		}

		core.info(`Generated payload for Microsoft Teams:\n${JSON.stringify(payload, null, 2)}`);

		if (dry_run === '' || dry_run==='false') {
			await msteams.notify(webhook_url, payload);
			core.info('Sent message to Microsoft Teams');
		} else {
			core.info('Dry run - skipping notification send. Done.');
		}
	} catch (err) {
		core.setFailed(err.message);
	}
}

if (require.main === module) {
	run();
} else {
	exports.run = run;
}
