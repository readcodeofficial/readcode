<?php

declare(strict_types=1);

namespace Helpdesk\Http;

use Helpdesk\Tickets\TicketFilter;
use Helpdesk\Tickets\TicketRepository;
use InvalidArgumentException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\ResponseFactoryInterface;

final class SearchController
{
    public function __construct(
        private readonly TicketRepository $tickets,
        private readonly ResponseFactoryInterface $responses,
    ) {
    }

    public function __invoke(ServerRequestInterface $request): ResponseInterface
    {
        $filter = TicketFilter::fromQuery($request->getQueryParams());

        try {
            $rows = $this->tickets->search($filter);
        } catch (InvalidArgumentException $e) {
            return $this->json(400, ['error' => $e->getMessage()]);
        }

        return $this->json(200, [
            'page' => $filter->page,
            'per_page' => $filter->perPage,
            'tickets' => $rows,
        ]);
    }

    private function json(int $status, array $payload): ResponseInterface
    {
        $response = $this->responses->createResponse($status)
            ->withHeader('Content-Type', 'application/json');
        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response;
    }
}
