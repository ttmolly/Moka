import random
from collections import deque

import pytest

from moka.snake.game import DIRECTIONS, SnakeGame, hamiltonian_cycle
from moka.snake.policy import LayaPolicy, local_checkpoint


@pytest.mark.parametrize("width,height", [(4, 4), (4, 5), (5, 4), (24, 16)])
def test_cycle_visits_every_cell_and_closes(width, height):
    cycle = hamiltonian_cycle(width, height)
    assert len(cycle) == len(set(cycle)) == width * height
    assert all(0 <= x < width and 0 <= y < height for x, y in cycle)
    assert all(
        abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1 for a, b in zip(cycle, cycle[1:] + cycle[:1])
    )


def test_collision_growth_tail_vacancy_and_board_clear():
    game = SnakeGame(4, 4, initial_length=4)
    game.body = deque([(1, 1), (1, 2), (0, 2), (0, 1)])
    game.food = (3, 3)
    assert game.legal_reason("LEFT") == "legal"
    assert game.legal_reason("DOWN") == "reverse"
    game.step("LEFT")
    assert game.alive and len(game.body) == 4
    game.step("LEFT")
    assert not game.alive and game.death_reason == "wall"

    full = SnakeGame(4, 4, initial_length=15)
    move = next(m for m in full.moves() if m.safe)
    assert full.step(move.direction)
    assert full.won and full.food is None and len(full.body) == 16 and full.score == 1
    assert full.moves() == []


@pytest.mark.parametrize("seed", range(12))
def test_arbitrary_shielded_choices_complete_board_without_starving(seed):
    game = SnakeGame(6, 6, seed=seed)
    rng = random.Random(seed + 100)
    last_food = 0
    for _ in range(game.capacity * (game.capacity - game.initial_length)):
        allowed = [m.direction for m in game.moves() if m.safe]
        assert allowed
        ate = game.step(rng.choice(allowed))
        assert game.alive and game.cycle_order_valid()
        assert len(game.body) == len(set(game.body))
        assert len(game.body) == game.initial_length + game.score
        assert game.ticks - last_food <= game.capacity
        if ate:
            last_food = game.ticks
        if game.won:
            break
    assert game.won


def test_seed_reproduces_foods_and_actions():
    first, second = SnakeGame(seed=71), SnakeGame(seed=71)
    for _ in range(100):
        direction = max((m for m in first.moves() if m.safe), key=lambda m: m.advance).direction
        first.step(direction)
        second.step(direction)
        assert first.snapshot() == second.snapshot()


def test_guard_preserves_raw_probabilities_and_reports_intervention():
    game = SnakeGame()
    safe = [m.direction for m in game.moves() if m.safe]
    unsafe = next(d for d in DIRECTIONS if d not in safe)
    probabilities = {d: 0.9 if d == unsafe else 0.1 / 3 for d in DIRECTIONS}

    class StubAgent:
        def predict(self, *_):
            return {
                "answers": {
                    "move": {"probabilities": probabilities},
                    "risk": {"noul": 0.97},
                    "food": {"noul": 0.92},
                },
                "usage": {"input_tokens": 100},
            }

    policy = LayaPolicy.__new__(LayaPolicy)
    policy.agent, policy.guarded = StubAgent(), True
    policy.prompt = "compact"
    result = policy.decide(game)
    assert result.proposed == unsafe and result.executed in safe and result.intervened
    assert result.probabilities is probabilities
    assert result.dead_end_risk == pytest.approx(0.03)
    policy.guarded = False
    assert policy.decide(game).executed == unsafe


def test_missing_local_model_fails_without_a_network_attempt(tmp_path):
    with pytest.raises(FileNotFoundError, match="does not exist"):
        local_checkpoint(tmp_path / "absent")


def test_small_or_odd_boards_are_rejected():
    for shape in ((3, 4), (4, 3), (5, 5)):
        with pytest.raises(ValueError):
            SnakeGame(*shape)
