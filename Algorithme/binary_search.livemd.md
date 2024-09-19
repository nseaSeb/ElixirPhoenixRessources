[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)
## Algo Binary search



```elixir
defmodule BinarySearch do
  def search(list, target) do
    do_search(list, target, 0, length(list) - 1, 0)
  end

  defp do_search(_, _, left, right, iterations) when left > right, do: {:not_found, iterations}

  defp do_search(list, target, left, right, iterations) do
    mid = div(left + right, 2)
    mid_value = Enum.at(list, mid)

    cond do
      target == mid_value -> {:ok, mid, iterations + 1}
      target < mid_value -> do_search(list, target, left, mid - 1, iterations + 1)
      target > mid_value -> do_search(list, target, mid + 1, right, iterations + 1)
    end
  end
end
```

```elixir
tableau = Enum.to_list(0..100)
numberToGuess = :rand.uniform(100)

case BinarySearch.search(tableau, numberToGuess) do
  {:ok, index, iterations} ->
    IO.puts(
      "Le nombre #{numberToGuess} a été trouvé à l'index #{index} en #{iterations} itérations."
    )

  {:not_found, iterations} ->
    IO.puts(
      "Le nombre #{numberToGuess} n'a pas été trouvé dans le tableau. Recherche effectuée en #{iterations} itérations."
    )
end
```
