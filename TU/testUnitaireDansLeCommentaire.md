[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)
## Test unitaire dans un commentaire

```
defmodule Math do
  @doc """
  Additionne deux nombres.
  Ci dessous les tests unitaires directement dans le commentaire, le double diese Exemples permet d'indiquer leurs présences.
  si la valeur sous l'appel de la fonction via iex équivaut au retour de la fonction, le test sera OK. 

  ## Exemples

      iex> Math.add(2, 3)
      5

      iex> Math.add(-1, 1)
      0

      iex> Math.add(0, 0)
      0

  """
  def add(a, b) do
    a + b
  end
end

```

Cependant, vous pouvez souhaitez évaluer un event par exemple, en dehors des tests unitaires distincts du code en lui même, voici une approche qui me semble élégante.

```
@doc """
  Gère l'événement de repositionnement des groupes dans le document.
  Cet event est soumis par le hook JS sortable permettant de réordonner des éléments.

  ## Exemple

   iex> socket = %Phoenix.LiveView.Socket{assigns: %{__changed__: %{}, document: %{groups: [%{id: "1", name: "A"}, %{id: "2", name: "B"}, %{id: "3", name: "C"}]}}}
   iex> {:noreply, updated_socket} = MyAppWeb.DocumentsLive.Edit.handle_event("reposition", %{"new" => 2, "old" => 0}, socket)
   iex> updated_socket.assigns.document.groups
   [%{id: "3", name: "C"}, %{id: "2", name: "B"}, %{id: "1", name: "A"}]


  """
  @impl true
  def handle_event("reposition", %{"new" => new, "old" => old}, socket) do
    groups = socket.assigns.document.groups
    new_group = Enum.at(groups, new)
    old_group = Enum.at(groups, old)

    updated_groups =
      groups
      |> List.replace_at(new, old_group)
      |> List.replace_at(old, new_group)

    {:noreply, assign(socket, document: %{socket.assigns.document | groups: updated_groups})}
  end

```
