<?php

declare(strict_types=1);

namespace Helpdesk\Tickets;

final class TicketFilter
{
    public const SORTABLE = [
        'created' => 't.created_at',
        'updated' => 't.updated_at',
        'priority' => 't.priority',
        'requester' => 'r.name',
    ];

    /**
     * @param list<string> $statuses
     */
    public function __construct(
        public readonly array $statuses = [],
        public readonly ?int $assigneeId = null,
        public readonly ?string $text = null,
        public readonly string $sort = 'created',
        public readonly string $direction = 'desc',
        public readonly int $page = 1,
        public readonly int $perPage = 25,
    ) {
    }

    public static function fromQuery(array $query): self
    {
        $statuses = isset($query['status']) ? array_values((array) $query['status']) : [];

        return new self(
            statuses: array_map('strval', $statuses),
            assigneeId: isset($query['assignee']) ? (int) $query['assignee'] : null,
            text: isset($query['q']) && $query['q'] !== '' ? (string) $query['q'] : null,
            sort: (string) ($query['sort'] ?? 'created'),
            direction: strtolower((string) ($query['dir'] ?? 'desc')),
            page: max(1, (int) ($query['page'] ?? 1)),
            perPage: min(100, max(1, (int) ($query['per_page'] ?? 25))),
        );
    }
}
