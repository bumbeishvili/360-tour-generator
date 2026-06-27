<script>
	import Header from '$lib/Header.svelte';
	import './styles.css';
	import '../app.css';
	import Meta from "$lib/Meta.svelte";
	import Footer from '$lib//Footer.svelte';
</script>

<div class="app">
	<Header />
	<Meta />
	<main class='w-full'>
		<slot />
	</main>
	<Footer />
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		margin: 0 auto;
		box-sizing: border-box;
	}
</style>
