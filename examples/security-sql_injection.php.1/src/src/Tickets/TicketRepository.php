<?php

declare(strict_types=1);

namespace Helpdesk\Tickets;

use InvalidArgumentException;
use PDO;

final class TicketRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function search(TicketFilter $filter): array
    {
        $where = ['t.deleted_at IS NULL'];
        $params = [];

        if ($filter->statuses !== []) {
            $placeholders = [];
            foreach ($filter->statuses as $i => $status) {
                $name = ':status' . $i;
                $placeholders[] = $name;
                $params[$name] = [$status, PDO::PARAM_STR];
            }
            $where[] = 't.status IN (' . implode(', ', $placeholders) . ')';
        }

        if ($filter->assigneeId !== null) {
            $where[] = 't.assignee_id = :assignee';
            $params[':assignee'] = [$filter->assigneeId, PDO::PARAM_INT];
        }

        if ($filter->text !== null) {
            $where[] = "(t.subject LIKE :needle_subject ESCAPE '!' OR r.name LIKE :needle_name ESCAPE '!')";
            $needle = '%' . $this->escapeLike($filter->text) . '%';
            $params[':needle_subject'] = [$needle, PDO::PARAM_STR];
            $params[':needle_name'] = [$needle, PDO::PARAM_STR];
        }

        $sql = 'SELECT t.id, t.subject, t.status, t.priority, t.created_at, r.name AS requester '
            . 'FROM tickets t JOIN requesters r ON r.id = t.requester_id '
            . 'WHERE ' . implode(' AND ', $where)
            . ' ORDER BY ' . $this->orderBy($filter)
            . ' LIMIT :limit OFFSET :offset';

        $params[':limit'] = [$filter->perPage, PDO::PARAM_INT];
        $params[':offset'] = [($filter->page - 1) * $filter->perPage, PDO::PARAM_INT];

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $name => [$value, $type]) {
            $stmt->bindValue($name, $value, $type);
        }
        $stmt->execute();

        return $stmt->fetchAll();
    }

    public function addNote(int $ticketId, int $authorId, string $body): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO ticket_notes (ticket_id, author_id, body) VALUES (:ticket, :author, :body)'
        );
        $stmt->execute([':ticket' => $ticketId, ':author' => $authorId, ':body' => $body]);

        return (int) $this->pdo->lastInsertId();
    }

    private function orderBy(TicketFilter $filter): string
    {
        $column = TicketFilter::SORTABLE[$filter->sort]
            ?? throw new InvalidArgumentException('Unsupported sort field');
        $direction = $filter->direction === 'asc' ? 'ASC' : 'DESC';

        return $column . ' ' . $direction . ', t.id ' . $direction;
    }

    private function escapeLike(string $text): string
    {
        return strtr($text, ['!' => '!!', '%' => '!%', '_' => '!_']);
    }
}
