import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requirePermission } from '../middleware/requirePermission';
import { AuthService } from '../../services/AuthService';

export const createSearchRouter = (
	searchController: SearchController,
	authService: AuthService
): Router => {
	const router = Router();

	router.use(requireAuth(authService));

	/**
	 * @openapi
	 * /v1/search:
	 *   get:
	 *     summary: Search archived emails
	 *     description: Performs a full-text search across indexed archived emails using Meilisearch. Requires `search:archive` permission. Use `keywords` for global search, or one field-specific text parameter (`subject`, `body`, `attachmentFilename`, or `attachmentContent`). Requests with more than one text search parameter are rejected.
	 *     operationId: searchEmails
	 *     tags:
	 *       - Search
	 *     security:
	 *       - bearerAuth: []
	 *       - apiKeyAuth: []
	 *     parameters:
	 *       - name: keywords
	 *         in: query
	 *         required: false
	 *         description: Global search query string across searchable email fields.
	 *         schema:
	 *           type: string
	 *           example: "invoice Q4"
	 *       - name: from
	 *         in: query
	 *         required: false
	 *         description: Exact sender email address filter. Input is trimmed and lowercased.
	 *         schema:
	 *           type: string
	 *           format: email
	 *           example: "sender@example.com"
	 *       - name: to
	 *         in: query
	 *         required: false
	 *         description: Exact recipient email address filter. Input is trimmed and lowercased.
	 *         schema:
	 *           type: string
	 *           format: email
	 *           example: "recipient@example.com"
	 *       - name: cc
	 *         in: query
	 *         required: false
	 *         description: Exact CC recipient email address filter. Input is trimmed and lowercased.
	 *         schema:
	 *           type: string
	 *           format: email
	 *           example: "copy@example.com"
	 *       - name: bcc
	 *         in: query
	 *         required: false
	 *         description: Exact BCC recipient email address filter. Input is trimmed and lowercased.
	 *         schema:
	 *           type: string
	 *           format: email
	 *           example: "hidden@example.com"
	 *       - name: subject
	 *         in: query
	 *         required: false
	 *         description: Search only the email subject. Cannot be combined with `keywords` or other field-specific text parameters.
	 *         schema:
	 *           type: string
	 *           example: "quarterly report"
	 *       - name: body
	 *         in: query
	 *         required: false
	 *         description: Search only the email body. Cannot be combined with `keywords` or other field-specific text parameters.
	 *         schema:
	 *           type: string
	 *           example: "contract renewal"
	 *       - name: attachmentFilename
	 *         in: query
	 *         required: false
	 *         description: Search only attachment filenames. Cannot be combined with `keywords` or other field-specific text parameters.
	 *         schema:
	 *           type: string
	 *           example: "invoice.pdf"
	 *       - name: attachmentContent
	 *         in: query
	 *         required: false
	 *         description: Search only extracted attachment content. Cannot be combined with `keywords` or other field-specific text parameters.
	 *         schema:
	 *           type: string
	 *           example: "purchase order"
	 *       - name: dateFrom
	 *         in: query
	 *         required: false
	 *         description: Include emails sent on or after this date.
	 *         schema:
	 *           type: string
	 *           format: date
	 *           example: "2026-01-01"
	 *       - name: dateTo
	 *         in: query
	 *         required: false
	 *         description: Include emails sent on or before this date.
	 *         schema:
	 *           type: string
	 *           format: date
	 *           example: "2026-01-31"
	 *       - name: page
	 *         in: query
	 *         required: false
	 *         description: Page number for pagination.
	 *         schema:
	 *           type: integer
	 *           default: 1
	 *           example: 1
	 *       - name: limit
	 *         in: query
	 *         required: false
	 *         description: Number of results per page.
	 *         schema:
	 *           type: integer
	 *           default: 10
	 *           example: 10
	 *       - name: matchingStrategy
	 *         in: query
	 *         required: false
	 *         description: Meilisearch matching strategy. `last` returns results containing at least one keyword; `all` requires all keywords; `frequency` sorts by keyword frequency.
	 *         schema:
	 *           type: string
	 *           enum: [last, all, frequency]
	 *           default: last
	 *     responses:
	 *       '200':
	 *         description: Search results.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/SearchResults'
	 *       '400':
	 *         description: Search criteria are missing or invalid.
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorMessage'
	 *       '401':
	 *         $ref: '#/components/responses/Unauthorized'
	 *       '500':
	 *         $ref: '#/components/responses/InternalServerError'
	 */
	router.get('/', requirePermission('search', 'archive'), searchController.search);

	return router;
};
